const core = require('@actions/core');
const exec = require('@actions/exec');
const fs = require('fs');

async function run() {
  try {
    const offerId = core.getInput('offer_id', { required: true });
    const configFilePath = core.getInput('configuration_file_path', { required: true });
    const spctlConfigFile = core.getInput('spctl_config_file');

    core.startGroup('Validating inputs');
    if (!fs.existsSync(configFilePath)) {
      throw new Error(`Configuration file does not exist at '${configFilePath}'.`);
    }
    core.info(`✅ Configuration file found.`);
    try {
      JSON.parse(fs.readFileSync(configFilePath, 'utf8'));
      core.info('✅ File content is valid JSON.');
    } catch (error) {
      throw new Error(`The file '${configFilePath}' does not contain valid JSON. Error: ${error.message}`);
    }
    core.endGroup();

    core.startGroup(`Updating offer ${offerId}`);
    const args = [
      'offers', 'update', 'value', offerId,
      '--configuration', configFilePath,
      '--config', spctlConfigFile
    ];
    core.info(`Running command: ./spctl ${args.join(' ')}`);
    await exec.exec('./spctl', args);
    core.info(`Offer ${offerId} updated successfully.`);
    core.endGroup();

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
