
import axios from 'axios';
import * as Homey from 'homey';
import { OGState, OGCommand, OGResponse, OGOptions } from './definations';
const ogSettings = ['riv', 'dth', 'vth', 'cdt', 'alm', 'aoo'];

class GarageDoorDevice extends Homey.Device {

	private doorOpenTrigger!: Homey.FlowCardTriggerDevice;
	private doorCloseTrigger!: Homey.FlowCardTriggerDevice;
	private vehicleStateChangeTrigger!: Homey.FlowCardTriggerDevice;

	private debounceActive: boolean = false;
	private debounceTimer!: NodeJS.Timeout;

	private pollTimeout!: NodeJS.Timeout;

	async onInit() {
		// Init flows

		/* Migration */
		if (this.hasCapability('garagedoor_closed') === false) {
			this.log(`Adding new garagedoor_closed capability to ${this.getName()}`);
			await this.addCapability('garagedoor_closed');
		}
		if (this.getClass() !== 'garagedoor') {
			this.log(`Changing class on ${this.getName()} from ${this.getClass()} to garagedoor`);
			await this.setClass('garagedoor')
		};

		/* Deprecation */
		if (this.hasCapability('door_state')) {
			this.log(`Removing old door_state capability from ${this.getName()}`);
			await this.removeCapability('door_state');
		}

		/* Deprecated */ this.doorOpenTrigger = this.homey.flow.getDeviceTriggerCard('door_open');
		/* Deprecated */ this.doorCloseTrigger = this.homey.flow.getDeviceTriggerCard('door_close');

		this.vehicleStateChangeTrigger = this.homey.flow.getDeviceTriggerCard('vehicle_state_change');

		// Init capabiltiies
		this.registerCapabilityListener('garagedoor_closed', this.doorStateChange.bind(this));

		// Start polling
		this.log(`Starting timer for device: ${this.getName()}`);
		this.pollData();

		this.getDeviceSettings();

	}

	sendDoorCommand(command: OGCommand): Promise<void> {

		return new Promise(async (resolve, reject) => {

			this.log(`Sending door command ${command} for ${this.getName()}`);

			this.axiosGet(`cc?dkey=${this.getSetting('deviceKey')}&${command}=1`)
				.then((res) => {
					const response: OGResponse = res.data;
					if (response.result == 1) {

						// calculate maximum time for door to be opened and registered as open by OpenGarage
						let doorTime = this.getDoorTime(command);

						// Debug
						this.log(`Waiting : ${doorTime} to poll`);

						// If zero just accept it is closed. Polltimer will fix it.
						if (doorTime == 0) return resolve();

						this.pollTimeout = setTimeout(() => {
							this.pollData(true)
								.then(() => {
									if (doorTime != 0) {
										let newDoorState = this.getCapabilityValue("garagedoor_closed") ? OGCommand.close : OGCommand.open;
										if (newDoorState == command) { resolve(); }
										else { reject(); }
									}
								})
								.catch(() => reject())

						}, doorTime * 1000);

					} else {

						reject(response.result);
					}
				})

				.catch((err) => reject(err))

		})

	}

	async doorStateChange(toClosed: boolean): Promise<void> {

		return new Promise((resolve, reject) => {

			if (this.debounceActive) {
				return reject(new Error(this.homey.__("errors.debounce")));
			} else {
				this.debounceActive = true;
			}

			// Stop the timer!
			clearTimeout(this.pollTimeout);

			this.sendDoorCommand(toClosed ? OGCommand.close : OGCommand.open)
				.then(() => resolve())
				.catch(() => reject(new Error(this.homey.__("errors.changing_door_state"))))
				.finally(() => {
					this.debounceActive = false;
					// Restart the timer
					this.pollTimeout = setTimeout(() => { this.pollData() }, this.getSetting('pollingRate') * 1000);
				});
		})

	}

	pollData(onlyOnce: boolean = false): Promise<void | OGState> {

		//this.log("Polling data, current pollingrate is set to:", this.getSetting('pollingRate'))

		return new Promise((resolve, reject) => {

			this.axiosGet('jc')
				.then(response => {
					this.parseData(response.data as OGState)
						.then(() => {
							if (!this.getAvailable()) { this.setAvailable(); }
							resolve();
						})
						.catch(() => { reject(); });
				})
				.catch((error) => {
					this.log(`Error polling data from device ${this.getName()}. Error given: ${error.code} (${error.errno})`);
					this.setUnavailable(this.homey.__("errors.polling", { error: error.code }));
					reject();
				})
				.finally(() => {
					if (!onlyOnce) {
						this.pollTimeout = setTimeout(() => { this.pollData() }, this.getSetting('pollingRate') * 1000);
					}
				})
		})

	}

	parseData(data: OGState) {

		// Create a variable for oor state
		const isDoorClosed = data.door == 0;

		// Proof vehicle state
		if (data.vehicle > 1) data.vehicle = 2;
		if (data.vehicle < 1) data.vehicle = 0;

		let promises = [];

		// Check if changed, if so call trigger something
		if (this.getCapabilityValue("garagedoor_closed") != isDoorClosed) {
			/* Deprecated */  if (isDoorClosed) { this.doorCloseTrigger?.trigger(this).catch(this.error); }
			/* Deprecated */  else { this.doorOpenTrigger?.trigger(this).catch(this.error); }
			promises.push(this.setCapabilityValue("garagedoor_closed", isDoorClosed));
		}

		if (this.getCapabilityValue("measure_distance") != data.dist)
			promises.push(this.setCapabilityValue("measure_distance", data.dist));

		if (this.getCapabilityValue("vehicle_state") != data.vehicle.toString()) {
			promises.push(this.setCapabilityValue("vehicle_state", data.vehicle.toString()));
			promises.push(this.vehicleStateChangeTrigger.trigger(this));
		}

		if (this.getCapabilityValue("measure_rssi") != data.rssi)
			promises.push(this.setCapabilityValue("measure_rssi", data.rssi));

		return Promise.all(promises);
	}


	getDeviceSettings() {
		return new Promise((resolve, reject) => {
			this.axiosGet('jo')
				.then((response) => {
					let currentSettings = this.getSettings();
					let data = response.data;
					for (let [key, value] of Object.entries(data)) {
						if (currentSettings[key] && currentSettings[key] != value) {
							if (key == "aoo") value = value == 1 ? false : true;
							currentSettings[key] = value;
						}
					}
					this.setSettings(currentSettings)
						.then(() => { resolve(true); });
				})
				.catch((error) => {
					this.error(`Error getting OG device config for ${this.getName()}. Error given: ${error.code} (${error.errno})`);
					reject(this.homey.__("errors.error_get_config"));
				})
		})
	}

	setDeviceSettings(urlParams: string) {
		return new Promise((resolve, reject) => {
			this.axiosGet(`co?dkey=${this.getSetting('deviceKey')}&${urlParams}`)
				.then((response: any) => {
					if (response.data.result == 1) { resolve(true); }
					else { throw new Error(this.homey.__("errors.wrong_response", { response: response.data.result })); }
				})
				.catch((error) => {
					this.error(`Error saving OG device config for ${this.getName()}. Error given: ${error.code} (${error.errno})`);
					reject(this.homey.__("errors.error_saving_config"));
				})

		})

	}


	async onSettings(event: any): Promise<string | void> {

		// OG Settings:
		let ogSettingChanged = event.changedKeys.some((key: string) => ogSettings.includes(key))
		if (ogSettingChanged) {
			let urlParams = "";
			ogSettings.forEach((key: string) => {
				let value = event.newSettings[key];
				if (key == "aoo") value = value ? 0 : 1;
				urlParams += `${key}=${value}&`
			})

			this.setDeviceSettings(urlParams.slice(0, -1))
				.catch(err => {
					Promise.reject("Unkonwn errror");
				})
				.finally(() => this.getDeviceSettings());
		}

		Promise.resolve("Settings saved");
	}

	async onDeleted(): Promise<string | void> {
		try {
			this.log(`Deleted device ${this.getName()} - Clearing timeouts if any`);
			clearTimeout(this.debounceTimer);
			clearTimeout(this.pollTimeout);
		} catch (e) {
			this.error(`Couuld not clear timeouts due to: ${e}`);
		}
	}

	getDoorTime(command: OGCommand): number {

		// Get door time
		let doorTime = this.getSetting('openCloseTime');

		// If disabled return 0
		if (doorTime == 0) return 0;

		// Then add the alarm time
		if (!this.getSetting('aoo') && command == OGCommand.open) doorTime += 0;
		else if (this.getSetting('alm') == 2) doorTime += 10;
		else if (this.getSetting('alm') == 1) doorTime += 5;

		// Then add the time it takes between each reads +1 sec for safe keeping.
		doorTime += parseInt(this.getSetting('riv')) + 1;

		return doorTime;
	}

	axiosGet(path: string): Promise<any> {

		const settings = this.getSettings();
		let endpoint = `http://${settings.ip}:${settings.port}/${path}`;

		try {
			return new Promise((resolve, reject) => {
				axios.get(endpoint)
					.then((res) => resolve(res))
					.catch((err) => reject(err))
			})
		} catch (e) {
			return Promise.reject(e);
		}
	}

}

module.exports = GarageDoorDevice;