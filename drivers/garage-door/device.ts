
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

	createEndpoint(path: string): string {

		const settings = this.getSettings();
		return `http://${settings.ip}:${settings.port}/${path}`;
	}

	async sendDoorCommand(command: OGCommand) {

		this.log(`Sending door command ${command} for ${this.getName()}`);

		try {

			const endpoint = this.createEndpoint(`cc?dkey=${this.getSetting('deviceKey')}&${command}=1`);
			const res = await axios.get(endpoint);
			const response: OGResponse = res.data;

			if (response.result == 1) {

				// calculate maximum time for door to be opened and registered as open by OpenGarage
				// First the time it takes to open/close it
				let doorOpenCloseTotalTime = this.getSetting('openCloseTime');

				// Then add the alarm time
				if (this.getSetting('alm') == 2) doorOpenCloseTotalTime += 10;
				if (this.getSetting('alm') == 1) doorOpenCloseTotalTime += 5;

				// Then add the time it takes between each reads +1 sec for safe keeping.
				doorOpenCloseTotalTime += parseInt(this.getSetting('riv')) + 1;

				// Now we should have the maximum time it should take to close / open and read from distance sensor.
				this.pollTimeout = setTimeout(() => { this.pollData() }, doorOpenCloseTotalTime * 1000);
				return Promise.resolve();
			} else {

				return Promise.reject(response.result);
			}
		} catch (error) {

			return Promise.reject(error);
		}

	}

	async doorStateChange(toClosed: boolean) {

		if (this.debounceActive) {
			throw new Error(this.homey.__("errors.debounce"));
		} else {
			this.debounceActive = true;
			clearTimeout(this.debounceTimer);
			this.debounceTimer = setTimeout(() => { this.debounceActive = false; }, 5000);
		}

		try {
			clearTimeout(this.pollTimeout);
			await this.sendDoorCommand(toClosed ? OGCommand.close : OGCommand.open);
			return Promise.resolve();
		} catch (error) {
			this.pollData();
			throw new Error(this.homey.__("errors.unknown", { error }));
		}


	}

	pollData(onlyOnce: boolean = false): void {

		axios.get(this.createEndpoint('jc'))
			.then(response => {
				this.parseData(response.data as OGState);
				if (!this.getAvailable()) { this.setAvailable(); }
			})
			.catch((error) => {
				this.log(`Error polling data from device ${this.getName()}. Error given: ${error.code} (${error.errno})`);
				this.setUnavailable(this.homey.__("errors.polling", { error: error.code }));
			})
			.finally(() => {
				if (onlyOnce != true) {
					this.pollTimeout = setTimeout(() => { this.pollData() }, this.getSetting('pollingRate') * 1000);
				}
			})

		//this.info("Polling data, current pollingrate is set to:", this.getSetting('pollingRate'))
	}

	parseData(data: OGState) {

		// Create a variable for oor state
		const isDoorClosed = data.door == 0;

		// Proof vehicle state
		if (data.vehicle > 1) data.vehicle = 2;
		if (data.vehicle < 1) data.vehicle = 0;

		// Check if changed, if so call trigger something
		if (this.getCapabilityValue("garagedoor_closed") != isDoorClosed) {
			/* Deprecated */  if (isDoorClosed) { this.doorCloseTrigger?.trigger(this).catch(this.error).finally(() => this.log("Trigger close door")); }
			/* Deprecated */  else { this.doorOpenTrigger?.trigger(this).catch(this.error).finally(() => this.log("Trigger open door")); }
			this.setCapabilityValue("garagedoor_closed", isDoorClosed);
		}

		if (this.getCapabilityValue("measure_distance") != data.dist)
			this.setCapabilityValue("measure_distance", data.dist);

		if (this.getCapabilityValue("vehicle_state") != data.vehicle.toString()) {
			this.setCapabilityValue("vehicle_state", data.vehicle.toString());
			this.vehicleStateChangeTrigger.trigger(this);
		}

		if (this.getCapabilityValue("measure_rssi") != data.rssi)
			this.setCapabilityValue("measure_rssi", data.rssi);
	}


	getDeviceSettings() {
		return new Promise((resolve, reject) => {
			let endpoint = this.createEndpoint('jo');
			axios.get(endpoint)
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
			let endpoint = this.createEndpoint(`co?dkey=${this.getSetting('deviceKey')}&${urlParams}`)
			axios.get(endpoint)
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

}

module.exports = GarageDoorDevice;