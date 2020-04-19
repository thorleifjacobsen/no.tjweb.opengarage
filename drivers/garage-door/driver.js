'use strict';

const Homey = require('homey');
const http  = require('http.min')

class GarageDoorDriver extends Homey.Driver {
	
	onInit() {

		this.log('GarageDoorDriver has been inited');
	}
	
	onPair( socket ) {

		socket.on('add', ( dev, callback ) => {
			const deviceOptionsUrl = `http://${dev.ip}:${dev.port}/jc`
			const deviceControlUrl = `http://${dev.ip}:${dev.port}/co?dkey=${dev.deviceKey}`

			/* Trying to get device options to return to client */
			http.json(deviceOptionsUrl)
			.then((deviceOptions) => {

				if(deviceOptions.fwv && deviceOptions.name) {

					this.log("Found OpenGarage '"+deviceOptions.name+"' firmware version: "+deviceOptions.fwv)

					http.json(deviceControlUrl)
					.then((deviceControl) => {

						if(deviceControl.result == 1) {

							this.log("Device Key accepted, approving device")
							callback(null, { success: true, data: deviceOptions })

						} else {

							this.log("Device Key not accepted, denying device")
							callback(null, { success: false, data: "Device key not accepted!" })

						}
					}).catch((error) => {

						this.log("Unknown error when trying device key:", error)
						callback(null, { success: false, data: "Unknown error when trying device key!" })
					})
				} else {

					this.log("Data found in options request was not as expected (rejecting): ", deviceControl)
					callback(null, { success: false, data: "Unexpected response got from device! Make sure this is a OpenGarage device and the details given are correct." })
				}
			}).catch((error) => {
				
				this.log("Error when trying to connect to device: ", error)
				callback(null, { success: false, data: "Unknown error when trying to connect to device." })

			})
    });
	}

}

module.exports = GarageDoorDriver;