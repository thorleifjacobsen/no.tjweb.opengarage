'use strict';

const Homey = require('homey');
const http  = require('http.min')

class GarageDoorDevice extends Homey.Device {
	
	onInit() {
		// Init flows
		this.doorOpenTrigger = new Homey.FlowCardTriggerDevice('door_open').register()
		this.doorCloseTrigger = new Homey.FlowCardTriggerDevice('door_close').register()
		this.vehicleStateChangeSTrigger = new Homey.FlowCardTriggerDevice('vehicle_state_change').register()

		this.doorCloseAction = new Homey.FlowCardAction('door_close').register().registerRunListener(async ( args, state ) => this.sendDoorCommand("close"))
		this.doorOpenAction = new Homey.FlowCardAction('door_open').register().registerRunListener(async ( args, state ) => this.sendDoorCommand("open"))

		this.isOpen = new Homey.FlowCardCondition('is_open').register().registerRunListener(async ( args ) => {
			return Promise.resolve(this.getCapabilityValue("door_state") == 'up')
		})
		this.vehicleIsPresent = new Homey.FlowCardCondition('vehicle_is_present').register().registerRunListener(async ( args ) => {
			return Promise.resolve(this.getCapabilityValue("vehicle_state") == '1')
		})
		this.heightIs = new Homey.FlowCardCondition('height_is').register().registerRunListener(async ( args ) => {
			return Promise.resolve(this.getCapabilityValue("measure_distance") > args.height)
		})

		// Debounce
		this.debounceActive = false
		this.debounceTimer = null

		// Init capabiltiies
		this.registerCapabilityListener('door_state', this.doorStateChange.bind(this))

		// Start polling
		this.log(`Starting timer for device: ${this.getName()}`)	
		this.pollData()
		this.lastData = false
	}

	createEndpoint(path) {

		const settings = this.getSettings()
		return `http://${settings.ip}:${settings.port}/${path}`
	}

	async sendDoorCommand(command) {

		const endpoint = this.createEndpoint(`cc?dkey=${this.getSetting('deviceKey')}&${command}=1`)
		try {
			this.log(`Trying to send: ${command} to ${this.getSetting('ip')}`)
			const reply = await http.json(endpoint)
			this.log(`Reply from device: ${reply.result}`)
			if(reply.result == 1) {
				this.log(`Door state successfully triggered: ${command}`)
				if(this.lastData) this.setCapabilityValue("door_state", this.lastData.door == 1 ? 'up' : 'down')
				setTimeout(() => { this.pollData(true) }, this.getSetting('openCloseTime')*1000)
				return Promise.resolve()
			} else {
				return Promise.reject(reply.result)
			}
		} catch(error) {
			return Promise.reject(error)
		}
		
	}
	
	async doorStateChange( direction, opts ) {

		if(this.debounceActive) {
			if(this.lastData) this.setCapabilityValue("door_state", this.lastData.door == 1 ? 'up' : 'down')
			throw new Error("A command have just been sent, please wait 5 seconds to send a new one");
		} else {
			this.debounceActive = true;
			clearTimeout(this.debounceTimer)
			this.debounceTimer = setTimeout(() => { this.debounceActive = false; }, 5000)
		}

		try {
			await this.sendDoorCommand(direction == "up" ? "open" : "close")
			return Promise.resolve();
		} catch (error) {
			throw new Error(`Unknown error occured: ${error}`)
		}


	}

	pollData(onlyOnce) {

		http.json(this.createEndpoint('jc'))
		.then((data) => { this.parseData(data) })
		.catch( (error) => { this.log(`Error polling data from device ${this.getName()}. Error given:`,error) })
		.then(() => { 
			if(onlyOnce != true) setTimeout(() => { this.pollData() }, this.getSetting('pollingRate')*1000); 
		})

		//this.log("Polling data, current pollingrate is set to:", this.getSetting('pollingRate'))
	}

	parseData(data) {
		// Update lastData
		this.lastData = data

		let doorValue = data.door == 1 ? 'up' : 'down';

		// Check if changed, if so call trigger something
		if(this.getCapabilityValue("door_state") != doorValue) {
			if     (data.door == 1) { this.doorOpenTrigger.trigger(this).catch( this.error ).then( this.log("Trigger open door") ) }
			else if(data.door == 0) { this.doorCloseTrigger.trigger(this).catch( this.error ).then( this.log("Trigger close door") ) }
			this.setCapabilityValue("door_state", doorValue)
		}

		if(this.getCapabilityValue("measure_distance") != data.dist) 
			this.setCapabilityValue("measure_distance", data.dist)

		if(this.getCapabilityValue("vehicle_state") != data.vehicle.toString()) 
			this.setCapabilityValue("vehicle_state", data.vehicle.toString())

		if(this.getCapabilityValue("measure_rssi") != data.rssi) 
			this.setCapabilityValue("measure_rssi", data.rssi)
	}



}

module.exports = GarageDoorDevice;