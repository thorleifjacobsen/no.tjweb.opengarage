'use strict';

const Homey = require('homey');

class OpenGarage extends Homey.App {
	
	onInit() {
		this.log('OpenGarage App - Initialized');
	}
	
}

module.exports = OpenGarage;