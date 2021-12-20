import Homey from 'homey';
import axios from 'axios';
import { OGResponse, OGState } from './definations';


class GarageDoorDriver extends Homey.Driver {

	async onInit() {

		this.log('GarageDoorDriver has been inited');
	}

	async onPair(session: any) {

		session.setHandler('add', async (device: any) => {

			const deviceOptionsUrl = `http://${device.ip}:${device.port}/jc`
			const deviceControlUrl = `http://${device.ip}:${device.port}/co?dkey=${device.deviceKey}`

			const returnObj = {
				success: false,
				message: "",
				data: {}
			}
			/* Trying to get device options to return to client */
			try {
				let response = await axios.get(deviceOptionsUrl);
				const state: OGState = response.data;

				if (state.fwv && state.name) {

					this.log("Found OpenGarage '" + state.name + "' firmware version: " + state.fwv)

					response = await axios.get(deviceControlUrl);
					const deviceControl: OGResponse = response.data

					if (deviceControl.result == 1) {

						this.log("Device Key accepted, approving device");
						return { success: true, data: state }
					}
					else {

						this.log("Device Key not accepted, denying device");
						returnObj.success = false;
						returnObj.message = this.homey.__("errors.wrong_devicekey");
					}
				}
				else {

					this.log("Data found in options request was not as expected (rejecting): ", state)
					returnObj.success = false;
					returnObj.message = this.homey.__("errors.unexpected_response");
				}
			}
			catch (error) {
				returnObj.success = false;
				returnObj.message = this.homey.__("errors.error_when_trying_key");
			}

			return returnObj;
		})
	}
}

module.exports = GarageDoorDriver;