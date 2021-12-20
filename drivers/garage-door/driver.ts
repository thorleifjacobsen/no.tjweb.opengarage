import Homey from 'homey';
import axios from 'axios';
import { OGResponse, OGState } from './definations';


class GarageDoorDriver extends Homey.Driver {

	async onInit() {

		this.log('GarageDoorDriver has been inited');
	}

	async onPair(socket: any) {

		socket.on('add', (dev: any, callback: any) => {
			const deviceOptionsUrl = `http://${dev.ip}:${dev.port}/jc`
			const deviceControlUrl = `http://${dev.ip}:${dev.port}/co?dkey=${dev.deviceKey}`

			/* Trying to get device options to return to client */
			axios.get(deviceOptionsUrl).then(response => {

				const state: OGState = response.data;

				if (state.fwv && state.name) {

					this.log("Found OpenGarage '" + state.name + "' firmware version: " + state.fwv)

					axios.get(deviceControlUrl)
						.then(response => {
							const deviceControl: OGResponse = response.data

							if (deviceControl.result == 1) {

								this.log("Device Key accepted, approving device")
								callback(null, { success: true, data: state })

							} else {

								this.log("Device Key not accepted, denying device")
								callback(null, { success: false, data: this.homey.__("error.wrong_devicekey") })

							}
						}).catch((error) => {

							this.log("Unknown error when trying device key:", error)
							callback(null, { success: false, data: this.homey.__("error.error_when_trying_key") })
						})
				} else {

					this.log("Data found in options request was not as expected (rejecting): ", state)
					callback(null, { success: false, data: this.homey.__("error.unexpected_response") })
				}
			}).catch((error) => {

				this.log("Error when trying to connect to device: ", error)
				callback(null, { success: false, data: this.homey.__("error.connecting") })

			})
		});
	}

}

module.exports = GarageDoorDriver;