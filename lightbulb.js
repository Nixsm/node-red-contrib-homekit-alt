/**
 * Copyright 2016 Michael Jacobsen / Marius Schmeding.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
    'use strict'
    
    var API            = require('./lib/api.js')(RED)
    var HapNodeJS      = require('hap-nodejs')
    var HK             = require('./lib/common_functions.js')

    var Accessory      = HapNodeJS.Accessory
    var Service        = HapNodeJS.Service
    var Characteristic = HapNodeJS.Characteristic
    var uuid           = HapNodeJS.uuid

    function HAPLightbulbNode(config) {
        RED.nodes.createNode(this, config)

        // service node properties
        this.name        = config.name
        this.serviceName = config.serviceName
        this.brightness  = config.brightness
        this.hue         = config.hue
        this.saturation  = config.saturation
        this.configNode  = RED.nodes.getNode(config.accessory)

        // generate UUID from node id
        var subtypeUUID = uuid.generate(this.id)

        // add service
        var accessory = this.configNode.accessory
        var service   = accessory.addService(Service[this.serviceName], this.name, subtypeUUID)

        //console.log(this.configNode)

        // this.configNode.manufacturer
        // this.configNode.serialNo
        // this.configNode.model
        // this.configNode.name             == LightbulbTest1

        this.service = service
        var node     = this

        // the pinCode should be shown to the user until interaction with iOS client starts
        node.status({fill: 'yellow', shape: 'ring', text: node.configNode.pinCode})

        // emit message when value changes (sent from HomeKit)
        service.on('characteristic-change', function (info) {
            var key = info.characteristic.displayName.replace(/ /g, '')
            
            node.status({fill: 'yellow', shape: 'dot', text: key + ': ' + info.newValue})
            setTimeout(function () { node.status({}) }, 3000)

            /*
            info = { oldValue: 0,
            newValue: '50',
            context: undefined,
            characteristic:
            Characteristic {
                displayName: 'Hue',
                UUID: '00000013-0000-1000-8000-0026BB765291',
                iid: null,
                value: '50',
                props:
                { format: 'float',
                    unit: 'arcdegrees',
                    minValue: 0,
                    maxValue: 360,
                    minStep: 1,
                    perms: [Object] },
                _events: { change: [Function: bound ] },
                _eventsCount: 1 } }
            */

            var msg = { payload: {}, hap: info}

            msg.manufacturer = node.configNode.manufacturer
            msg.serialno     = node.configNode.serialNo
            msg.model        = node.configNode.model
            msg.name         = node.configNode.name
            msg.format       = info.characteristic.props.format
            msg.event        = key
            
            msg.payload      = HK.FormatValue(info.characteristic.props.format, info.newValue)

            if (msg.payload == null) {
                node.warn("Unable to format value")
                return
            }

            console.log("HAPLightbulbNode(): msg.payload =", msg.payload)

            //
            // send message on the right output
            //
            switch (key) {
                case "On":
                    node.send([msg, null, null, null])
                    break
                case "Brightness":
                    node.send([null, msg, null, null])
                    break
                case "Hue":
                    node.send([null, null, msg, null])
                    break
                case "Saturation":
                    node.send([null, null, null, msg])
                    break
                default:
                    node.warn("Unknown characteristics '" + characteristics + "'")
                    return 
            }
        })

        // which characteristics are supported?
        var supported = { read: [], write: []}

        var allCharacteristics = service.characteristics.concat(service.optionalCharacteristics)
        
        allCharacteristics.map(function (characteristic, index) {
            var cKey = characteristic.displayName.replace(/ /g, '')
            
            if (characteristic.props.perms.indexOf('pw') > -1) {
                supported.read.push(cKey)
            }

            if ((characteristic.props.perms.indexOf('pr') + characteristic.props.perms.indexOf('ev')) > -2) {
                supported.write.push(cKey)
            }
        })

        //
        // set defaults
        //
        if (node.brightness > -1) {
            service.setCharacteristic(Characteristic["Brightness"], node.brightness)
        }

        if (node.hue > -1) {
            service.setCharacteristic(Characteristic["Hue"], node.hue)
        }

        if (node.saturation > -1) {
            service.setCharacteristic(Characteristic["Saturation"], node.saturation)
        }

        // respond to inputs
        this.on('input', function (msg) {
            var characteristic
            var val

            if (!msg.hasOwnProperty('topic')) {
                node.warn('Invalid message (topic missing)')
                return
            } else if (!msg.hasOwnProperty('payload')) {
                node.warn('Invalid message (payload missing)')
                return
            } else {
                //
                // deal with the msg.topic
                //
                if (msg.topic.toUpperCase() == "ON") {
                    characteristic = "On"
                } else if (msg.topic.toUpperCase() == "BRIGHTNESS") {
                    characteristic = "Brightness"
                } else if (msg.topic.toUpperCase() == "HUE") {
                    characteristic = "Hue"
                } else if (msg.topic.toUpperCase() == "SATURATION") {
                    characteristic = "Saturation"
                } else {
                    node.warn('Invalid topic')
                    return
                }

                //
                // deal with the msg.payload
                //
                val = HK.FormatValue(service.getCharacteristic(Characteristic[characteristic]).props.format, msg.payload)

                if (val == null) {
                    node.warn("Unable to format value")
                    return
                }
            }

            if (supported.write.indexOf(characteristic) < 0) {
                node.warn("Characteristic " + characteristic + " cannot be written to")
            } else {
                // send to HomeKit
                service.setCharacteristic(Characteristic[characteristic], val)
            }
        })

        this.on('close', function () {
            accessory.removeService(service)
        })

    }
    
    RED.nodes.registerType('homekit-lightbulb', HAPLightbulbNode)
}
