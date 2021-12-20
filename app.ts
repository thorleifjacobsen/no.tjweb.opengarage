import Homey from 'homey';

class OpenGarage extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('OpenGarage App - Initialized');
  }

}
module.exports = OpenGarage;