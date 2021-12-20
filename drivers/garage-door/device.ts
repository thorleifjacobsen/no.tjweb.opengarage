
import axios from 'axios';
import Homey, { FlowCardAction, FlowCardCondition, FlowCardTrigger, FlowCardTriggerDevice } from 'homey';
import { OGState, OGCommand, OGResponse } from './definations';

class GarageDoorDevice extends Homey.Device {

	private doorOpenTrigger!: FlowCardTriggerDevice;
	private doorCloseTrigger!: FlowCardTriggerDevice;
	private vehicleStateChangeTrigger!: FlowCardTriggerDevice;

	private debounceActive: boolean = false;
	private debounceTimer!: NodeJS.Timeout;

	private lastData: OGState | undefined;

	async onInit() {
		// Init flows

		this.doorOpenTrigger = this.homey.flow.getDeviceTriggerCard('door_open');
		this.doorCloseTrigger = this.homey.flow.getDeviceTriggerCard('door_close');

		this.vehicleStateChangeTrigger = this.homey.flow.getDeviceTriggerCard('vehicle_state_change');

		this.homey.flow.getActionCard('door_close').registerRunListener(async (args) => {
			let device: GarageDoorDevice = args.device;
			device.sendDoorCommand(OGCommand.close);
		});

		this.homey.flow.getActionCard('door_open').registerRunListener(async (args) => {
			let device: GarageDoorDevice = args.device;
			device.sendDoorCommand(OGCommand.open);
		});

		this.homey.flow.getConditionCard('is_open').registerRunListener(async (args) => {
			let device: GarageDoorDevice = args.device;
			return ! device.getCapabilityDoorState();
		});

		this.homey.flow.getConditionCard('vehicle_is_present').registerRunListener((args) => {
			return args.device.getCapabilityValue("vehicle_state") == '1'
		});

		this.homey.flow.getConditionCard('height_is').registerRunListener(async (args) => {
			return args.device.getCapabilityValue("measure_distance") > args.height;
		});

		// Debounce

		// Init capabiltiies
		this.registerCapabilityListener('garagedoor_closed', this.doorStateChange.bind(this))

		/* deprecated */ this.registerCapabilityListener('door_state', (value) => { this.doorStateChange(value == "down"); })

		// Start polling
		this.log(`Starting timer for device: ${this.getName()}`)
		this.pollData()

	}

	createEndpoint(path: string): string {

		const settings = this.getSettings()
		return `http://${settings.ip}:${settings.port}/${path}`
	}

	async sendDoorCommand(command: OGCommand) {

		this.log(`Sending door command ${command} for ${this.getName()}`)

		try {

			const endpoint = this.createEndpoint(`cc?dkey=${this.getSetting('deviceKey')}&${command}=1`)
			const res = await axios.get(endpoint);
			const response: OGResponse = res.data;

			if (response.result == 1) {
				// TODO: See if this is nessesary?
				//if (this.lastData) this.setCapabilityValue("door_state", this.lastData.door == 1 ? 'up' : 'down')
				setTimeout(() => { this.pollData(true) }, this.getSetting('openCloseTime') * 1000)
				return Promise.resolve()
			} else {

				return Promise.reject(response.result)
			}
		} catch (error) {

			return Promise.reject(error)
		}

	}

	async doorStateChange(toClosed: boolean) {

		if (this.debounceActive) {
			if (this.lastData) { 
				this.setCapabilityDoorState(this.lastData.door == 0)
			}
			throw new Error(this.homey.__("errors.debounce"));
		} else {
			this.debounceActive = true;
			clearTimeout(this.debounceTimer)
			this.debounceTimer = setTimeout(() => { this.debounceActive = false; }, 5000)
		}

		try {
			await this.sendDoorCommand(toClosed ? OGCommand.close : OGCommand.open)
			return Promise.resolve();
		} catch (error) {
			throw new Error(this.homey.__("errors.unknown", { error }))
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
			.then(() => {
				if (onlyOnce != true) {
					setTimeout(() => { this.pollData() }, this.getSetting('pollingRate') * 1000);
				}
			})

		//this.log("Polling data, current pollingrate is set to:", this.getSetting('pollingRate'))
	}

	parseData(data: OGState) {

		// Update lastData
		this.lastData = data

		let doorValue = data.door == 1 ? 'up' : 'down';
		let isDoorClosed = data.door == 0;

		// Check if changed, if so call trigger something
		if (this.getCapabilityDoorState() != isDoorClosed) {
			if (isDoorClosed) { this.doorCloseTrigger?.trigger(this).catch(this.error).then(() => this.log("Trigger close door")) }
			else { this.doorOpenTrigger?.trigger(this).catch(this.error).then(() => this.log("Trigger open door")) }
			this.setCapabilityDoorState(isDoorClosed)
		}

		if (this.getCapabilityValue("measure_distance") != data.dist)
			this.setCapabilityValue("measure_distance", data.dist)

		if (this.getCapabilityValue("vehicle_state") != data.vehicle.toString())
			this.setCapabilityValue("vehicle_state", data.vehicle.toString())

		if (this.getCapabilityValue("measure_rssi") != data.rssi)
			this.setCapabilityValue("measure_rssi", data.rssi)
	}

	setCapabilityDoorState(isClosed: boolean) {
		
		/* deprecated */ if(this.hasCapability('door_state')) this.setCapabilityValue("door_state", isClosed ? 'down' : 'yp');
		if(this.hasCapability('garagedoor_closed')) this.setCapabilityValue("garagedoor_closed", isClosed);
	}

	getCapabilityDoorState() {

		/* deprecated */ if(this.hasCapability('door_state')) return this.getCapabilityValue("door_state") == "down";
		if(this.hasCapability('garagedoor_closed')) return this.getCapabilityValue("garagedoor_closed");

	}

}

module.exports = GarageDoorDevice;