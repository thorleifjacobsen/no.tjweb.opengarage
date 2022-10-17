import * as Homey from 'homey';
import axios from 'axios';
import { OGResponse, OGState, OGCommand } from './definations';


class GarageDoorDriver extends Homey.Driver {

	async onInit() {

		this.log('GarageDoorDriver has been inited');

		/* Up this to show the below message again */
		const deprecrationNotification = 1;

		/* First time this is "null", it will be set to 1 once this if's run once! */
		if (this.homey.settings.get("deprecrationNotification") < deprecrationNotification) {

			this.log("Showing deprecration notification");
			this.homey.settings.set("deprecrationNotification", deprecrationNotification);
			this.homey.notifications.createNotification({
				excerpt: "**Breaking changes:**\nIn future updates some flow cards may be removed. " +
					"To avoid breaking changes in your system replace all flow cards related to " +
					"the garage door state. All deprecrated flow cards are invisible so just replace " +
					"with those you can see who fits your use case. The affected flow cards are: " +
					"\n\n" +
					"**Triggers:** Garage door open/closed\n" +
					"**Conditions:** Door is open/closed\n" +
					"**Actions:** Open/Close garage door\n\n"
			});
		}


		/* Deprecated */  this.homey.flow.getActionCard('door_close').registerRunListener(async (args) => {
			args.device.sendDoorCommand(OGCommand.close);
		});

		/* Deprecated */  this.homey.flow.getActionCard('door_open').registerRunListener(async (args) => {
			args.device.sendDoorCommand(OGCommand.open);
		});

		/* Deprecated */  this.homey.flow.getConditionCard('is_open').registerRunListener(async (args) => {
			return !args.device.getCapabilityValue("garagedoor_closed");
		});

		this.homey.flow.getConditionCard('vehicle_is_present').registerRunListener((args) => {
			return args.device.getCapabilityValue("vehicle_state") == '1'
		});

		this.homey.flow.getConditionCard('height_is').registerRunListener(async (args) => {
			return args.device.getCapabilityValue("measure_distance") > args.height;
		});
		
	}



	async onPair(session: any) {

		session.setHandler('add', async (device: any) => {

			const deviceOptionsUrl = `http://${device.ip}:${device.port}/jc`
			const deviceControlUrl = `http://${device.ip}:${device.port}/co?dkey=${device.deviceKey}`

			const failObject = { success: false,	message: "" }

			/* Trying to get device options to return to client */
			try {
				let response = await axios.get(deviceOptionsUrl);
				const state: OGState = response.data;

				if (state.fwv && state.name) {

					this.log(`Found OpenGarage ${state.name} firmware version: ${state.fwv}`)

					response = await axios.get(deviceControlUrl);
					const deviceControl: OGResponse = response.data

					if (deviceControl.result == 1) {

						this.log("Device Key accepted, approving device");
						return { success: true, data: state }
					}
					else {

						this.log("Device Key not accepted, denying device");
						failObject.message = this.homey.__("errors.wrong_devicekey");
					}
				}
				else {

					this.log("Data found in options request was not as expected (rejecting): ", state)
					failObject.message = this.homey.__("errors.unexpected_response");
				}
			}
			catch (error) {
				failObject.message = this.homey.__("errors.error_when_trying_key");
			}

			return failObject;
		})
	}
}

module.exports = GarageDoorDriver;