const fz = require('zigbee-herdsman-converters/converters/fromZigbee');
const tz = require('zigbee-herdsman-converters/converters/toZigbee');
const exposes = require('zigbee-herdsman-converters/lib/exposes');
const reporting = require('zigbee-herdsman-converters/lib/reporting');
const e = exposes.presets;
const ea = exposes.access;


const tzLocal = {
    node_config: {
        key: ['read_sensors_delay', 'poll_rate_on', 'tx_radio_power'],
        convertSet: async (entity, key, rawValue, meta) => {
            const lookup = {'OFF': 0x00, 'ON': 0x01};
            const value = lookup.hasOwnProperty(rawValue) ? lookup[rawValue] : parseInt(rawValue, 10);
            const payloads = {
                read_sensors_delay: ['genPowerCfg', {0x0201: {value, type: 0x21}}],
                poll_rate_on: ['genPowerCfg', {0x0216: {value, type: 0x10}}],
                tx_radio_power: ['genPowerCfg', {0x0236: {value, type: 0x28}}],
            };
            await entity.write(payloads[key][0], payloads[key][1]);
            return {
                state: {[key]: rawValue},
            };
        },
    },
	node_debug: {
        key: ['lower_level', 'upper_level'],
        convertSet: async (entity, key, rawValue, meta) => {
            const lookup = {'OFF': 0x00, 'ON': 0x01};
            const value = lookup.hasOwnProperty(rawValue) ? lookup[rawValue] : parseInt(rawValue, 10);
            const payloads = {
                lower_level: ['msSoilMoisture', {0x0502: {value, type: 0x21}}],
                upper_level: ['msSoilMoisture', {0x0503: {value, type: 0x21}}],
            };
            await entity.write(payloads[key][0], payloads[key][1]);
            return {
                state: {[key]: rawValue},
            };
        },
    },
	temperaturef_config: {
        key: ['temperature_offset', 'temperature_compensation'],
        convertSet: async (entity, key, rawValue, meta) => {
            const value = parseFloat(rawValue)*10;
            const payloads = {
                temperature_offset: ['msTemperatureMeasurement', {0x0410: {value, type: 0x29}}],
                temperature_compensation: ['msTemperatureMeasurement', {0x0504: {value, type: 0x10}}],
            };
            await entity.write(payloads[key][0], payloads[key][1]);
            return {
                state: {[key]: rawValue},
            };
        },
    },
};

const fzLocal = {
    node_config: {
        cluster: 'genPowerCfg',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.hasOwnProperty(0x0201)) {
                result.read_sensors_delay = msg.data[0x0201];
            }
            if (msg.data.hasOwnProperty(0x0216)) {
                result.poll_rate_on = ['OFF', 'ON'][msg.data[0x0216]];
            }
            if (msg.data.hasOwnProperty(0x0236)) {
                result.tx_radio_power = msg.data[0x0236];
            }
            return result;
        },
    },
	node_debug: {
        cluster: 'msSoilMoisture',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.hasOwnProperty(0x0502)) {
                result.lower_level = msg.data[0x0502];
            }
            if (msg.data.hasOwnProperty(0x0503)) {
                result.upper_level = msg.data[0x0503];
            }
            return result;
        },
    },
	temperaturef_config: {
        cluster: 'msTemperatureMeasurement',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.hasOwnProperty(0x0410)) {
                result.temperature_offset = parseFloat(msg.data[0x0410])/10.0;
            }
            if (msg.data.hasOwnProperty(0x0504)) {
                result.temperature_compensation = ['OFF', 'ON'][msg.data[0x0504]];
            }
            return result;
        },
    },
	uptime: {
        cluster: 'genTime',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            //return {uptime: Math.round(msg.data.localTime/60)};
            if (msg.data.hasOwnProperty('standardTime')) {
            	return {uptime: Math.round(msg.data.standardTime/60/60)};
            }
        },
    },
	illuminance: {
        cluster: 'msIlluminanceMeasurement',
        type: ['attributeReport', 'readResponse'],
        convert: (model, msg, publish, options, meta) => {
            const result = {};
            if (msg.data.hasOwnProperty('measuredValue')) {
                const illuminance_raw = msg.data['measuredValue'];
                const illuminance = illuminance_raw === 0 ? 0 : Math.pow(10, (illuminance_raw - 1) / 10000);
                result.illuminance = illuminance;
                result.illuminance_raw = illuminance_raw;
                }
            return result;
        },
    },
};

const definition = {
        zigbeeModel: ['zFlora_S_Max'],
        model: 'zFlora_S_Max',
        vendor: 'Custom devices (DiY)',
        description: '[Plant watering sensor zFlora_S Max](http://efektalab.com/PWS_Max)',
        fromZigbee: [fz.temperature, fz.humidity, fzLocal.illuminance, fz.soil_moisture, fz.battery, fzLocal.node_config, fzLocal.temperaturef_config, fzLocal.node_debug, fzLocal.uptime],
        toZigbee: [tz.factory_reset, tzLocal.node_config, tzLocal.temperaturef_config, tzLocal.node_debug],
        configure: async (device, coordinatorEndpoint, logger) => {
            const firstEndpoint = device.getEndpoint(1);
            await reporting.bind(firstEndpoint, coordinatorEndpoint, [
                'genTime', 'genPowerCfg', 'msTemperatureMeasurement', 'msRelativeHumidity', 'msSoilMoisture', 'msIlluminanceMeasurement']);
            const overrides1 = {min: 3600, max: 43200, change: 1};
            const overrides2 = {min: 300, max: 3600, change: 25};
            const overrides3 = {min: 300, max: 3600, change: 50};
            const overrides4 = {min: 300, max: 3600, change: 10};
            const overrides5 = {min: 60, max: 21600, change: 100};
            await reporting.batteryVoltage(firstEndpoint, overrides1);
            await reporting.batteryPercentageRemaining(firstEndpoint, overrides1);
            await reporting.batteryAlarmState(firstEndpoint, overrides1);
            await reporting.temperature(firstEndpoint, overrides2);
            await reporting.humidity(firstEndpoint, overrides3);
            await reporting.illuminance(firstEndpoint, overrides4);
            await reporting.soil_moisture(firstEndpoint, overrides5);
        },
		icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAH0AAAB9CAYAAACPgGwlAAABN2lDQ1BBZG9iZSBSR0IgKDE5OTgpAAAokZWPv0rDUBSHvxtFxaFWCOLgcCdRUGzVwYxJW4ogWKtDkq1JQ5ViEm6uf/oQjm4dXNx9AidHwUHxCXwDxamDQ4QMBYvf9J3fORzOAaNi152GUYbzWKt205Gu58vZF2aYAoBOmKV2q3UAECdxxBjf7wiA10277jTG+38yH6ZKAyNguxtlIYgK0L/SqQYxBMygn2oQD4CpTto1EE9AqZf7G1AKcv8ASsr1fBBfgNlzPR+MOcAMcl8BTB1da4Bakg7UWe9Uy6plWdLuJkEkjweZjs4zuR+HiUoT1dFRF8jvA2AxH2w3HblWtay99X/+PRHX82Vun0cIQCw9F1lBeKEuf1UYO5PrYsdwGQ7vYXpUZLs3cLcBC7dFtlqF8hY8Dn8AwMZP/fNTP8gAAAAJcEhZcwAADsQAAA7EAZUrDhsAAAXRaVRYdFhNTDpjb20uYWRvYmUueG1wAAAAAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzE0MiA3OS4xNjA5MjQsIDIwMTcvMDcvMTMtMDE6MDY6MzkgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bWxuczpwaG90b3Nob3A9Imh0dHA6Ly9ucy5hZG9iZS5jb20vcGhvdG9zaG9wLzEuMC8iIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKSIgeG1wOkNyZWF0ZURhdGU9IjIwMjMtMDktMjhUMTc6MTA6MTArMDM6MDAiIHhtcDpNb2RpZnlEYXRlPSIyMDIzLTExLTE3VDE4OjQyOjA0KzAzOjAwIiB4bXA6TWV0YWRhdGFEYXRlPSIyMDIzLTExLTE3VDE4OjQyOjA0KzAzOjAwIiBkYzpmb3JtYXQ9ImltYWdlL3BuZyIgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDplNWQzMDg4My05NTc4LWFiNDEtYjI5Ni0yY2JmOGUyOGE2NTMiIHhtcE1NOkRvY3VtZW50SUQ9ImFkb2JlOmRvY2lkOnBob3Rvc2hvcDpjMGRkOTYwNy1lMjA5LWVjNDctOTQ0YS1hY2E4ZTMzODU5MmIiIHhtcE1NOk9yaWdpbmFsRG9jdW1lbnRJRD0ieG1wLmRpZDozZjIyMjQ3Zi1iNzJhLTM3NGYtYjQyYy1kY2EwYzQxYzc0N2EiPiA8eG1wTU06SGlzdG9yeT4gPHJkZjpTZXE+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJjcmVhdGVkIiBzdEV2dDppbnN0YW5jZUlEPSJ4bXAuaWlkOjNmMjIyNDdmLWI3MmEtMzc0Zi1iNDJjLWRjYTBjNDFjNzQ3YSIgc3RFdnQ6d2hlbj0iMjAyMy0wOS0yOFQxNzoxMDoxMCswMzowMCIgc3RFdnQ6c29mdHdhcmVBZ2VudD0iQWRvYmUgUGhvdG9zaG9wIENDIDIwMTggKFdpbmRvd3MpIi8+IDxyZGY6bGkgc3RFdnQ6YWN0aW9uPSJzYXZlZCIgc3RFdnQ6aW5zdGFuY2VJRD0ieG1wLmlpZDplNWQzMDg4My05NTc4LWFiNDEtYjI5Ni0yY2JmOGUyOGE2NTMiIHN0RXZ0OndoZW49IjIwMjMtMTEtMTdUMTg6NDI6MDQrMDM6MDAiIHN0RXZ0OnNvZnR3YXJlQWdlbnQ9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE4IChXaW5kb3dzKSIgc3RFdnQ6Y2hhbmdlZD0iLyIvPiA8L3JkZjpTZXE+IDwveG1w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',
        exposes: [e.soil_moisture(), e.battery(), e.battery_low(), e.battery_voltage(), e.temperature(), e.humidity(), e.illuminance(), e.illuminance_raw(),
		exposes.numeric('read_sensors_delay', ea.STATE_SET).withUnit('Minutes').withDescription('Adjust Report Delay. Setting the time in minutes, by default 3 minutes')
			.withValueMin(1).withValueMax(360),
		exposes.enum('tx_radio_power', ea.STATE_SET, [0, 4]).withDescription('Set TX Radio Power)'),
		exposes.binary('poll_rate_on', ea.STATE_SET, 'ON', 'OFF').withDescription('Poll rate on off'),
		exposes.numeric('uptime', ea.STATE).withUnit('Hours').withDescription('Uptime'),
		exposes.numeric('lower_level', ea.STATE_SET).withUnit('%').withDescription('The lower level of soil moisture 0% is:')
			.withValueMin(0).withValueMax(99),
		exposes.numeric('upper_level', ea.STATE_SET).withUnit('%').withDescription('The upper level of soil moisture 100% is:')
                	.withValueMin(1).withValueMax(100),
		exposes.binary('temperature_compensation', ea.STATE_SET, 'ON', 'OFF').withDescription('Temperature compensation'),
		exposes.numeric('temperature_offset', ea.STATE_SET).withUnit('°C').withValueStep(0.1).withDescription('Adjust temperature')
                	.withValueMin(-50.0).withValueMax(50.0)],
};

module.exports = definition;
