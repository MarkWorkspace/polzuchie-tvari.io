/*eslint-disable block-scoped-var, id-length, no-control-regex, no-magic-numbers, no-prototype-builtins, no-redeclare, no-shadow, no-var, sort-vars*/
import * as $protobuf from "protobufjs/minimal";

// Common aliases
const $Reader = $protobuf.Reader, $Writer = $protobuf.Writer, $util = $protobuf.util;

// Exported root namespace
const $root = $protobuf.roots["default"] || ($protobuf.roots["default"] = {});

export const snake = $root.snake = (() => {

    /**
     * Namespace snake.
     * @exports snake
     * @namespace
     */
    const snake = {};

    snake.WorldConfig = (function() {

        /**
         * Properties of a WorldConfig.
         * @memberof snake
         * @interface IWorldConfig
         * @property {number|null} [width] WorldConfig width
         * @property {number|null} [height] WorldConfig height
         * @property {number|null} [portals_enabled] WorldConfig portals_enabled
         * @property {number|null} [portals_count] WorldConfig portals_count
         * @property {number|null} [portals_radius] WorldConfig portals_radius
         * @property {number|null} [portals_teleport_delay_ms] WorldConfig portals_teleport_delay_ms
         * @property {number|null} [portals_spawn_chance] WorldConfig portals_spawn_chance
         * @property {number|null} [portals_growth_time] WorldConfig portals_growth_time
         * @property {number|null} [black_holes_enabled] WorldConfig black_holes_enabled
         * @property {number|null} [black_holes_count] WorldConfig black_holes_count
         * @property {number|null} [black_holes_spawn_chance] WorldConfig black_holes_spawn_chance
         * @property {number|null} [black_holes_pull_radius] WorldConfig black_holes_pull_radius
         * @property {number|null} [black_holes_pull_force] WorldConfig black_holes_pull_force
         * @property {number|null} [black_holes_kill_radius] WorldConfig black_holes_kill_radius
         * @property {number|null} [black_holes_growth_time] WorldConfig black_holes_growth_time
         */

        /**
         * Constructs a new WorldConfig.
         * @memberof snake
         * @classdesc Represents a WorldConfig.
         * @implements IWorldConfig
         * @constructor
         * @param {snake.IWorldConfig=} [properties] Properties to set
         */
        function WorldConfig(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * WorldConfig width.
         * @member {number|null|undefined} width
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.width = null;

        /**
         * WorldConfig height.
         * @member {number|null|undefined} height
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.height = null;

        /**
         * WorldConfig portals_enabled.
         * @member {number|null|undefined} portals_enabled
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.portals_enabled = null;

        /**
         * WorldConfig portals_count.
         * @member {number|null|undefined} portals_count
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.portals_count = null;

        /**
         * WorldConfig portals_radius.
         * @member {number|null|undefined} portals_radius
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.portals_radius = null;

        /**
         * WorldConfig portals_teleport_delay_ms.
         * @member {number|null|undefined} portals_teleport_delay_ms
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.portals_teleport_delay_ms = null;

        /**
         * WorldConfig portals_spawn_chance.
         * @member {number|null|undefined} portals_spawn_chance
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.portals_spawn_chance = null;

        /**
         * WorldConfig portals_growth_time.
         * @member {number|null|undefined} portals_growth_time
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.portals_growth_time = null;

        /**
         * WorldConfig black_holes_enabled.
         * @member {number|null|undefined} black_holes_enabled
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.black_holes_enabled = null;

        /**
         * WorldConfig black_holes_count.
         * @member {number|null|undefined} black_holes_count
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.black_holes_count = null;

        /**
         * WorldConfig black_holes_spawn_chance.
         * @member {number|null|undefined} black_holes_spawn_chance
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.black_holes_spawn_chance = null;

        /**
         * WorldConfig black_holes_pull_radius.
         * @member {number|null|undefined} black_holes_pull_radius
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.black_holes_pull_radius = null;

        /**
         * WorldConfig black_holes_pull_force.
         * @member {number|null|undefined} black_holes_pull_force
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.black_holes_pull_force = null;

        /**
         * WorldConfig black_holes_kill_radius.
         * @member {number|null|undefined} black_holes_kill_radius
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.black_holes_kill_radius = null;

        /**
         * WorldConfig black_holes_growth_time.
         * @member {number|null|undefined} black_holes_growth_time
         * @memberof snake.WorldConfig
         * @instance
         */
        WorldConfig.prototype.black_holes_growth_time = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_width", {
            get: $util.oneOfGetter($oneOfFields = ["width"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_height", {
            get: $util.oneOfGetter($oneOfFields = ["height"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_portals_enabled", {
            get: $util.oneOfGetter($oneOfFields = ["portals_enabled"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_portals_count", {
            get: $util.oneOfGetter($oneOfFields = ["portals_count"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_portals_radius", {
            get: $util.oneOfGetter($oneOfFields = ["portals_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_portals_teleport_delay_ms", {
            get: $util.oneOfGetter($oneOfFields = ["portals_teleport_delay_ms"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_portals_spawn_chance", {
            get: $util.oneOfGetter($oneOfFields = ["portals_spawn_chance"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_portals_growth_time", {
            get: $util.oneOfGetter($oneOfFields = ["portals_growth_time"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_black_holes_enabled", {
            get: $util.oneOfGetter($oneOfFields = ["black_holes_enabled"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_black_holes_count", {
            get: $util.oneOfGetter($oneOfFields = ["black_holes_count"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_black_holes_spawn_chance", {
            get: $util.oneOfGetter($oneOfFields = ["black_holes_spawn_chance"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_black_holes_pull_radius", {
            get: $util.oneOfGetter($oneOfFields = ["black_holes_pull_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_black_holes_pull_force", {
            get: $util.oneOfGetter($oneOfFields = ["black_holes_pull_force"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_black_holes_kill_radius", {
            get: $util.oneOfGetter($oneOfFields = ["black_holes_kill_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(WorldConfig.prototype, "_black_holes_growth_time", {
            get: $util.oneOfGetter($oneOfFields = ["black_holes_growth_time"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new WorldConfig instance using the specified properties.
         * @function create
         * @memberof snake.WorldConfig
         * @static
         * @param {snake.IWorldConfig=} [properties] Properties to set
         * @returns {snake.WorldConfig} WorldConfig instance
         */
        WorldConfig.create = function create(properties) {
            return new WorldConfig(properties);
        };

        /**
         * Encodes the specified WorldConfig message. Does not implicitly {@link snake.WorldConfig.verify|verify} messages.
         * @function encode
         * @memberof snake.WorldConfig
         * @static
         * @param {snake.IWorldConfig} message WorldConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        WorldConfig.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.width != null && Object.hasOwnProperty.call(message, "width"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.width);
            if (message.height != null && Object.hasOwnProperty.call(message, "height"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.height);
            if (message.portals_enabled != null && Object.hasOwnProperty.call(message, "portals_enabled"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.portals_enabled);
            if (message.portals_count != null && Object.hasOwnProperty.call(message, "portals_count"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.portals_count);
            if (message.portals_radius != null && Object.hasOwnProperty.call(message, "portals_radius"))
                writer.uint32(/* id 5, wireType 5 =*/45).float(message.portals_radius);
            if (message.portals_teleport_delay_ms != null && Object.hasOwnProperty.call(message, "portals_teleport_delay_ms"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.portals_teleport_delay_ms);
            if (message.portals_spawn_chance != null && Object.hasOwnProperty.call(message, "portals_spawn_chance"))
                writer.uint32(/* id 7, wireType 5 =*/61).float(message.portals_spawn_chance);
            if (message.portals_growth_time != null && Object.hasOwnProperty.call(message, "portals_growth_time"))
                writer.uint32(/* id 8, wireType 5 =*/69).float(message.portals_growth_time);
            if (message.black_holes_enabled != null && Object.hasOwnProperty.call(message, "black_holes_enabled"))
                writer.uint32(/* id 9, wireType 0 =*/72).int32(message.black_holes_enabled);
            if (message.black_holes_count != null && Object.hasOwnProperty.call(message, "black_holes_count"))
                writer.uint32(/* id 10, wireType 0 =*/80).int32(message.black_holes_count);
            if (message.black_holes_spawn_chance != null && Object.hasOwnProperty.call(message, "black_holes_spawn_chance"))
                writer.uint32(/* id 11, wireType 5 =*/93).float(message.black_holes_spawn_chance);
            if (message.black_holes_pull_radius != null && Object.hasOwnProperty.call(message, "black_holes_pull_radius"))
                writer.uint32(/* id 12, wireType 5 =*/101).float(message.black_holes_pull_radius);
            if (message.black_holes_pull_force != null && Object.hasOwnProperty.call(message, "black_holes_pull_force"))
                writer.uint32(/* id 13, wireType 5 =*/109).float(message.black_holes_pull_force);
            if (message.black_holes_kill_radius != null && Object.hasOwnProperty.call(message, "black_holes_kill_radius"))
                writer.uint32(/* id 14, wireType 5 =*/117).float(message.black_holes_kill_radius);
            if (message.black_holes_growth_time != null && Object.hasOwnProperty.call(message, "black_holes_growth_time"))
                writer.uint32(/* id 15, wireType 5 =*/125).float(message.black_holes_growth_time);
            return writer;
        };

        /**
         * Encodes the specified WorldConfig message, length delimited. Does not implicitly {@link snake.WorldConfig.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.WorldConfig
         * @static
         * @param {snake.IWorldConfig} message WorldConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        WorldConfig.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a WorldConfig message from the specified reader or buffer.
         * @function decode
         * @memberof snake.WorldConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.WorldConfig} WorldConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        WorldConfig.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.WorldConfig();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.width = reader.int32();
                        break;
                    }
                case 2: {
                        message.height = reader.int32();
                        break;
                    }
                case 3: {
                        message.portals_enabled = reader.int32();
                        break;
                    }
                case 4: {
                        message.portals_count = reader.int32();
                        break;
                    }
                case 5: {
                        message.portals_radius = reader.float();
                        break;
                    }
                case 6: {
                        message.portals_teleport_delay_ms = reader.int32();
                        break;
                    }
                case 7: {
                        message.portals_spawn_chance = reader.float();
                        break;
                    }
                case 8: {
                        message.portals_growth_time = reader.float();
                        break;
                    }
                case 9: {
                        message.black_holes_enabled = reader.int32();
                        break;
                    }
                case 10: {
                        message.black_holes_count = reader.int32();
                        break;
                    }
                case 11: {
                        message.black_holes_spawn_chance = reader.float();
                        break;
                    }
                case 12: {
                        message.black_holes_pull_radius = reader.float();
                        break;
                    }
                case 13: {
                        message.black_holes_pull_force = reader.float();
                        break;
                    }
                case 14: {
                        message.black_holes_kill_radius = reader.float();
                        break;
                    }
                case 15: {
                        message.black_holes_growth_time = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a WorldConfig message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.WorldConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.WorldConfig} WorldConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        WorldConfig.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a WorldConfig message.
         * @function verify
         * @memberof snake.WorldConfig
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        WorldConfig.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.width != null && Object.hasOwnProperty.call(message, "width")) {
                properties._width = 1;
                if (!$util.isInteger(message.width))
                    return "width: integer expected";
            }
            if (message.height != null && Object.hasOwnProperty.call(message, "height")) {
                properties._height = 1;
                if (!$util.isInteger(message.height))
                    return "height: integer expected";
            }
            if (message.portals_enabled != null && Object.hasOwnProperty.call(message, "portals_enabled")) {
                properties._portals_enabled = 1;
                if (!$util.isInteger(message.portals_enabled))
                    return "portals_enabled: integer expected";
            }
            if (message.portals_count != null && Object.hasOwnProperty.call(message, "portals_count")) {
                properties._portals_count = 1;
                if (!$util.isInteger(message.portals_count))
                    return "portals_count: integer expected";
            }
            if (message.portals_radius != null && Object.hasOwnProperty.call(message, "portals_radius")) {
                properties._portals_radius = 1;
                if (typeof message.portals_radius !== "number")
                    return "portals_radius: number expected";
            }
            if (message.portals_teleport_delay_ms != null && Object.hasOwnProperty.call(message, "portals_teleport_delay_ms")) {
                properties._portals_teleport_delay_ms = 1;
                if (!$util.isInteger(message.portals_teleport_delay_ms))
                    return "portals_teleport_delay_ms: integer expected";
            }
            if (message.portals_spawn_chance != null && Object.hasOwnProperty.call(message, "portals_spawn_chance")) {
                properties._portals_spawn_chance = 1;
                if (typeof message.portals_spawn_chance !== "number")
                    return "portals_spawn_chance: number expected";
            }
            if (message.portals_growth_time != null && Object.hasOwnProperty.call(message, "portals_growth_time")) {
                properties._portals_growth_time = 1;
                if (typeof message.portals_growth_time !== "number")
                    return "portals_growth_time: number expected";
            }
            if (message.black_holes_enabled != null && Object.hasOwnProperty.call(message, "black_holes_enabled")) {
                properties._black_holes_enabled = 1;
                if (!$util.isInteger(message.black_holes_enabled))
                    return "black_holes_enabled: integer expected";
            }
            if (message.black_holes_count != null && Object.hasOwnProperty.call(message, "black_holes_count")) {
                properties._black_holes_count = 1;
                if (!$util.isInteger(message.black_holes_count))
                    return "black_holes_count: integer expected";
            }
            if (message.black_holes_spawn_chance != null && Object.hasOwnProperty.call(message, "black_holes_spawn_chance")) {
                properties._black_holes_spawn_chance = 1;
                if (typeof message.black_holes_spawn_chance !== "number")
                    return "black_holes_spawn_chance: number expected";
            }
            if (message.black_holes_pull_radius != null && Object.hasOwnProperty.call(message, "black_holes_pull_radius")) {
                properties._black_holes_pull_radius = 1;
                if (typeof message.black_holes_pull_radius !== "number")
                    return "black_holes_pull_radius: number expected";
            }
            if (message.black_holes_pull_force != null && Object.hasOwnProperty.call(message, "black_holes_pull_force")) {
                properties._black_holes_pull_force = 1;
                if (typeof message.black_holes_pull_force !== "number")
                    return "black_holes_pull_force: number expected";
            }
            if (message.black_holes_kill_radius != null && Object.hasOwnProperty.call(message, "black_holes_kill_radius")) {
                properties._black_holes_kill_radius = 1;
                if (typeof message.black_holes_kill_radius !== "number")
                    return "black_holes_kill_radius: number expected";
            }
            if (message.black_holes_growth_time != null && Object.hasOwnProperty.call(message, "black_holes_growth_time")) {
                properties._black_holes_growth_time = 1;
                if (typeof message.black_holes_growth_time !== "number")
                    return "black_holes_growth_time: number expected";
            }
            return null;
        };

        /**
         * Creates a WorldConfig message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.WorldConfig
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.WorldConfig} WorldConfig
         */
        WorldConfig.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.WorldConfig)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.WorldConfig: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.WorldConfig();
            if (object.width != null)
                message.width = object.width | 0;
            if (object.height != null)
                message.height = object.height | 0;
            if (object.portals_enabled != null)
                message.portals_enabled = object.portals_enabled | 0;
            if (object.portals_count != null)
                message.portals_count = object.portals_count | 0;
            if (object.portals_radius != null)
                message.portals_radius = Number(object.portals_radius);
            if (object.portals_teleport_delay_ms != null)
                message.portals_teleport_delay_ms = object.portals_teleport_delay_ms | 0;
            if (object.portals_spawn_chance != null)
                message.portals_spawn_chance = Number(object.portals_spawn_chance);
            if (object.portals_growth_time != null)
                message.portals_growth_time = Number(object.portals_growth_time);
            if (object.black_holes_enabled != null)
                message.black_holes_enabled = object.black_holes_enabled | 0;
            if (object.black_holes_count != null)
                message.black_holes_count = object.black_holes_count | 0;
            if (object.black_holes_spawn_chance != null)
                message.black_holes_spawn_chance = Number(object.black_holes_spawn_chance);
            if (object.black_holes_pull_radius != null)
                message.black_holes_pull_radius = Number(object.black_holes_pull_radius);
            if (object.black_holes_pull_force != null)
                message.black_holes_pull_force = Number(object.black_holes_pull_force);
            if (object.black_holes_kill_radius != null)
                message.black_holes_kill_radius = Number(object.black_holes_kill_radius);
            if (object.black_holes_growth_time != null)
                message.black_holes_growth_time = Number(object.black_holes_growth_time);
            return message;
        };

        /**
         * Creates a plain object from a WorldConfig message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.WorldConfig
         * @static
         * @param {snake.WorldConfig} message WorldConfig
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        WorldConfig.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.width != null && Object.hasOwnProperty.call(message, "width")) {
                object.width = message.width;
                if (options.oneofs)
                    object._width = "width";
            }
            if (message.height != null && Object.hasOwnProperty.call(message, "height")) {
                object.height = message.height;
                if (options.oneofs)
                    object._height = "height";
            }
            if (message.portals_enabled != null && Object.hasOwnProperty.call(message, "portals_enabled")) {
                object.portals_enabled = message.portals_enabled;
                if (options.oneofs)
                    object._portals_enabled = "portals_enabled";
            }
            if (message.portals_count != null && Object.hasOwnProperty.call(message, "portals_count")) {
                object.portals_count = message.portals_count;
                if (options.oneofs)
                    object._portals_count = "portals_count";
            }
            if (message.portals_radius != null && Object.hasOwnProperty.call(message, "portals_radius")) {
                object.portals_radius = options.json && !isFinite(message.portals_radius) ? String(message.portals_radius) : message.portals_radius;
                if (options.oneofs)
                    object._portals_radius = "portals_radius";
            }
            if (message.portals_teleport_delay_ms != null && Object.hasOwnProperty.call(message, "portals_teleport_delay_ms")) {
                object.portals_teleport_delay_ms = message.portals_teleport_delay_ms;
                if (options.oneofs)
                    object._portals_teleport_delay_ms = "portals_teleport_delay_ms";
            }
            if (message.portals_spawn_chance != null && Object.hasOwnProperty.call(message, "portals_spawn_chance")) {
                object.portals_spawn_chance = options.json && !isFinite(message.portals_spawn_chance) ? String(message.portals_spawn_chance) : message.portals_spawn_chance;
                if (options.oneofs)
                    object._portals_spawn_chance = "portals_spawn_chance";
            }
            if (message.portals_growth_time != null && Object.hasOwnProperty.call(message, "portals_growth_time")) {
                object.portals_growth_time = options.json && !isFinite(message.portals_growth_time) ? String(message.portals_growth_time) : message.portals_growth_time;
                if (options.oneofs)
                    object._portals_growth_time = "portals_growth_time";
            }
            if (message.black_holes_enabled != null && Object.hasOwnProperty.call(message, "black_holes_enabled")) {
                object.black_holes_enabled = message.black_holes_enabled;
                if (options.oneofs)
                    object._black_holes_enabled = "black_holes_enabled";
            }
            if (message.black_holes_count != null && Object.hasOwnProperty.call(message, "black_holes_count")) {
                object.black_holes_count = message.black_holes_count;
                if (options.oneofs)
                    object._black_holes_count = "black_holes_count";
            }
            if (message.black_holes_spawn_chance != null && Object.hasOwnProperty.call(message, "black_holes_spawn_chance")) {
                object.black_holes_spawn_chance = options.json && !isFinite(message.black_holes_spawn_chance) ? String(message.black_holes_spawn_chance) : message.black_holes_spawn_chance;
                if (options.oneofs)
                    object._black_holes_spawn_chance = "black_holes_spawn_chance";
            }
            if (message.black_holes_pull_radius != null && Object.hasOwnProperty.call(message, "black_holes_pull_radius")) {
                object.black_holes_pull_radius = options.json && !isFinite(message.black_holes_pull_radius) ? String(message.black_holes_pull_radius) : message.black_holes_pull_radius;
                if (options.oneofs)
                    object._black_holes_pull_radius = "black_holes_pull_radius";
            }
            if (message.black_holes_pull_force != null && Object.hasOwnProperty.call(message, "black_holes_pull_force")) {
                object.black_holes_pull_force = options.json && !isFinite(message.black_holes_pull_force) ? String(message.black_holes_pull_force) : message.black_holes_pull_force;
                if (options.oneofs)
                    object._black_holes_pull_force = "black_holes_pull_force";
            }
            if (message.black_holes_kill_radius != null && Object.hasOwnProperty.call(message, "black_holes_kill_radius")) {
                object.black_holes_kill_radius = options.json && !isFinite(message.black_holes_kill_radius) ? String(message.black_holes_kill_radius) : message.black_holes_kill_radius;
                if (options.oneofs)
                    object._black_holes_kill_radius = "black_holes_kill_radius";
            }
            if (message.black_holes_growth_time != null && Object.hasOwnProperty.call(message, "black_holes_growth_time")) {
                object.black_holes_growth_time = options.json && !isFinite(message.black_holes_growth_time) ? String(message.black_holes_growth_time) : message.black_holes_growth_time;
                if (options.oneofs)
                    object._black_holes_growth_time = "black_holes_growth_time";
            }
            return object;
        };

        /**
         * Converts this WorldConfig to JSON.
         * @function toJSON
         * @memberof snake.WorldConfig
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        WorldConfig.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for WorldConfig
         * @function getTypeUrl
         * @memberof snake.WorldConfig
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        WorldConfig.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.WorldConfig";
        };

        return WorldConfig;
    })();

    snake.SimulationConfig = (function() {

        /**
         * Properties of a SimulationConfig.
         * @memberof snake
         * @interface ISimulationConfig
         * @property {number|null} [tick_rate] SimulationConfig tick_rate
         * @property {number|null} [base_speed_per_second] SimulationConfig base_speed_per_second
         * @property {number|null} [max_turn_speed_deg_per_second] SimulationConfig max_turn_speed_deg_per_second
         * @property {number|null} [min_turn_radius] SimulationConfig min_turn_radius
         * @property {number|null} [turn_radius_thickness_coeff] SimulationConfig turn_radius_thickness_coeff
         * @property {number|null} [turn_idle_smoothing_at_20hz] SimulationConfig turn_idle_smoothing_at_20hz
         * @property {number|null} [turn_active_smoothing_at_20hz] SimulationConfig turn_active_smoothing_at_20hz
         */

        /**
         * Constructs a new SimulationConfig.
         * @memberof snake
         * @classdesc Represents a SimulationConfig.
         * @implements ISimulationConfig
         * @constructor
         * @param {snake.ISimulationConfig=} [properties] Properties to set
         */
        function SimulationConfig(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SimulationConfig tick_rate.
         * @member {number|null|undefined} tick_rate
         * @memberof snake.SimulationConfig
         * @instance
         */
        SimulationConfig.prototype.tick_rate = null;

        /**
         * SimulationConfig base_speed_per_second.
         * @member {number|null|undefined} base_speed_per_second
         * @memberof snake.SimulationConfig
         * @instance
         */
        SimulationConfig.prototype.base_speed_per_second = null;

        /**
         * SimulationConfig max_turn_speed_deg_per_second.
         * @member {number|null|undefined} max_turn_speed_deg_per_second
         * @memberof snake.SimulationConfig
         * @instance
         */
        SimulationConfig.prototype.max_turn_speed_deg_per_second = null;

        /**
         * SimulationConfig min_turn_radius.
         * @member {number|null|undefined} min_turn_radius
         * @memberof snake.SimulationConfig
         * @instance
         */
        SimulationConfig.prototype.min_turn_radius = null;

        /**
         * SimulationConfig turn_radius_thickness_coeff.
         * @member {number|null|undefined} turn_radius_thickness_coeff
         * @memberof snake.SimulationConfig
         * @instance
         */
        SimulationConfig.prototype.turn_radius_thickness_coeff = null;

        /**
         * SimulationConfig turn_idle_smoothing_at_20hz.
         * @member {number|null|undefined} turn_idle_smoothing_at_20hz
         * @memberof snake.SimulationConfig
         * @instance
         */
        SimulationConfig.prototype.turn_idle_smoothing_at_20hz = null;

        /**
         * SimulationConfig turn_active_smoothing_at_20hz.
         * @member {number|null|undefined} turn_active_smoothing_at_20hz
         * @memberof snake.SimulationConfig
         * @instance
         */
        SimulationConfig.prototype.turn_active_smoothing_at_20hz = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SimulationConfig.prototype, "_tick_rate", {
            get: $util.oneOfGetter($oneOfFields = ["tick_rate"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SimulationConfig.prototype, "_base_speed_per_second", {
            get: $util.oneOfGetter($oneOfFields = ["base_speed_per_second"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SimulationConfig.prototype, "_max_turn_speed_deg_per_second", {
            get: $util.oneOfGetter($oneOfFields = ["max_turn_speed_deg_per_second"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SimulationConfig.prototype, "_min_turn_radius", {
            get: $util.oneOfGetter($oneOfFields = ["min_turn_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SimulationConfig.prototype, "_turn_radius_thickness_coeff", {
            get: $util.oneOfGetter($oneOfFields = ["turn_radius_thickness_coeff"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SimulationConfig.prototype, "_turn_idle_smoothing_at_20hz", {
            get: $util.oneOfGetter($oneOfFields = ["turn_idle_smoothing_at_20hz"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SimulationConfig.prototype, "_turn_active_smoothing_at_20hz", {
            get: $util.oneOfGetter($oneOfFields = ["turn_active_smoothing_at_20hz"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new SimulationConfig instance using the specified properties.
         * @function create
         * @memberof snake.SimulationConfig
         * @static
         * @param {snake.ISimulationConfig=} [properties] Properties to set
         * @returns {snake.SimulationConfig} SimulationConfig instance
         */
        SimulationConfig.create = function create(properties) {
            return new SimulationConfig(properties);
        };

        /**
         * Encodes the specified SimulationConfig message. Does not implicitly {@link snake.SimulationConfig.verify|verify} messages.
         * @function encode
         * @memberof snake.SimulationConfig
         * @static
         * @param {snake.ISimulationConfig} message SimulationConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SimulationConfig.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.tick_rate != null && Object.hasOwnProperty.call(message, "tick_rate"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.tick_rate);
            if (message.base_speed_per_second != null && Object.hasOwnProperty.call(message, "base_speed_per_second"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.base_speed_per_second);
            if (message.max_turn_speed_deg_per_second != null && Object.hasOwnProperty.call(message, "max_turn_speed_deg_per_second"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.max_turn_speed_deg_per_second);
            if (message.min_turn_radius != null && Object.hasOwnProperty.call(message, "min_turn_radius"))
                writer.uint32(/* id 4, wireType 5 =*/37).float(message.min_turn_radius);
            if (message.turn_radius_thickness_coeff != null && Object.hasOwnProperty.call(message, "turn_radius_thickness_coeff"))
                writer.uint32(/* id 5, wireType 5 =*/45).float(message.turn_radius_thickness_coeff);
            if (message.turn_idle_smoothing_at_20hz != null && Object.hasOwnProperty.call(message, "turn_idle_smoothing_at_20hz"))
                writer.uint32(/* id 6, wireType 5 =*/53).float(message.turn_idle_smoothing_at_20hz);
            if (message.turn_active_smoothing_at_20hz != null && Object.hasOwnProperty.call(message, "turn_active_smoothing_at_20hz"))
                writer.uint32(/* id 7, wireType 5 =*/61).float(message.turn_active_smoothing_at_20hz);
            return writer;
        };

        /**
         * Encodes the specified SimulationConfig message, length delimited. Does not implicitly {@link snake.SimulationConfig.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.SimulationConfig
         * @static
         * @param {snake.ISimulationConfig} message SimulationConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SimulationConfig.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a SimulationConfig message from the specified reader or buffer.
         * @function decode
         * @memberof snake.SimulationConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.SimulationConfig} SimulationConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SimulationConfig.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.SimulationConfig();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.tick_rate = reader.int32();
                        break;
                    }
                case 2: {
                        message.base_speed_per_second = reader.float();
                        break;
                    }
                case 3: {
                        message.max_turn_speed_deg_per_second = reader.float();
                        break;
                    }
                case 4: {
                        message.min_turn_radius = reader.float();
                        break;
                    }
                case 5: {
                        message.turn_radius_thickness_coeff = reader.float();
                        break;
                    }
                case 6: {
                        message.turn_idle_smoothing_at_20hz = reader.float();
                        break;
                    }
                case 7: {
                        message.turn_active_smoothing_at_20hz = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SimulationConfig message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.SimulationConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.SimulationConfig} SimulationConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SimulationConfig.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SimulationConfig message.
         * @function verify
         * @memberof snake.SimulationConfig
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SimulationConfig.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.tick_rate != null && Object.hasOwnProperty.call(message, "tick_rate")) {
                properties._tick_rate = 1;
                if (!$util.isInteger(message.tick_rate))
                    return "tick_rate: integer expected";
            }
            if (message.base_speed_per_second != null && Object.hasOwnProperty.call(message, "base_speed_per_second")) {
                properties._base_speed_per_second = 1;
                if (typeof message.base_speed_per_second !== "number")
                    return "base_speed_per_second: number expected";
            }
            if (message.max_turn_speed_deg_per_second != null && Object.hasOwnProperty.call(message, "max_turn_speed_deg_per_second")) {
                properties._max_turn_speed_deg_per_second = 1;
                if (typeof message.max_turn_speed_deg_per_second !== "number")
                    return "max_turn_speed_deg_per_second: number expected";
            }
            if (message.min_turn_radius != null && Object.hasOwnProperty.call(message, "min_turn_radius")) {
                properties._min_turn_radius = 1;
                if (typeof message.min_turn_radius !== "number")
                    return "min_turn_radius: number expected";
            }
            if (message.turn_radius_thickness_coeff != null && Object.hasOwnProperty.call(message, "turn_radius_thickness_coeff")) {
                properties._turn_radius_thickness_coeff = 1;
                if (typeof message.turn_radius_thickness_coeff !== "number")
                    return "turn_radius_thickness_coeff: number expected";
            }
            if (message.turn_idle_smoothing_at_20hz != null && Object.hasOwnProperty.call(message, "turn_idle_smoothing_at_20hz")) {
                properties._turn_idle_smoothing_at_20hz = 1;
                if (typeof message.turn_idle_smoothing_at_20hz !== "number")
                    return "turn_idle_smoothing_at_20hz: number expected";
            }
            if (message.turn_active_smoothing_at_20hz != null && Object.hasOwnProperty.call(message, "turn_active_smoothing_at_20hz")) {
                properties._turn_active_smoothing_at_20hz = 1;
                if (typeof message.turn_active_smoothing_at_20hz !== "number")
                    return "turn_active_smoothing_at_20hz: number expected";
            }
            return null;
        };

        /**
         * Creates a SimulationConfig message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.SimulationConfig
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.SimulationConfig} SimulationConfig
         */
        SimulationConfig.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.SimulationConfig)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.SimulationConfig: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.SimulationConfig();
            if (object.tick_rate != null)
                message.tick_rate = object.tick_rate | 0;
            if (object.base_speed_per_second != null)
                message.base_speed_per_second = Number(object.base_speed_per_second);
            if (object.max_turn_speed_deg_per_second != null)
                message.max_turn_speed_deg_per_second = Number(object.max_turn_speed_deg_per_second);
            if (object.min_turn_radius != null)
                message.min_turn_radius = Number(object.min_turn_radius);
            if (object.turn_radius_thickness_coeff != null)
                message.turn_radius_thickness_coeff = Number(object.turn_radius_thickness_coeff);
            if (object.turn_idle_smoothing_at_20hz != null)
                message.turn_idle_smoothing_at_20hz = Number(object.turn_idle_smoothing_at_20hz);
            if (object.turn_active_smoothing_at_20hz != null)
                message.turn_active_smoothing_at_20hz = Number(object.turn_active_smoothing_at_20hz);
            return message;
        };

        /**
         * Creates a plain object from a SimulationConfig message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.SimulationConfig
         * @static
         * @param {snake.SimulationConfig} message SimulationConfig
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SimulationConfig.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.tick_rate != null && Object.hasOwnProperty.call(message, "tick_rate")) {
                object.tick_rate = message.tick_rate;
                if (options.oneofs)
                    object._tick_rate = "tick_rate";
            }
            if (message.base_speed_per_second != null && Object.hasOwnProperty.call(message, "base_speed_per_second")) {
                object.base_speed_per_second = options.json && !isFinite(message.base_speed_per_second) ? String(message.base_speed_per_second) : message.base_speed_per_second;
                if (options.oneofs)
                    object._base_speed_per_second = "base_speed_per_second";
            }
            if (message.max_turn_speed_deg_per_second != null && Object.hasOwnProperty.call(message, "max_turn_speed_deg_per_second")) {
                object.max_turn_speed_deg_per_second = options.json && !isFinite(message.max_turn_speed_deg_per_second) ? String(message.max_turn_speed_deg_per_second) : message.max_turn_speed_deg_per_second;
                if (options.oneofs)
                    object._max_turn_speed_deg_per_second = "max_turn_speed_deg_per_second";
            }
            if (message.min_turn_radius != null && Object.hasOwnProperty.call(message, "min_turn_radius")) {
                object.min_turn_radius = options.json && !isFinite(message.min_turn_radius) ? String(message.min_turn_radius) : message.min_turn_radius;
                if (options.oneofs)
                    object._min_turn_radius = "min_turn_radius";
            }
            if (message.turn_radius_thickness_coeff != null && Object.hasOwnProperty.call(message, "turn_radius_thickness_coeff")) {
                object.turn_radius_thickness_coeff = options.json && !isFinite(message.turn_radius_thickness_coeff) ? String(message.turn_radius_thickness_coeff) : message.turn_radius_thickness_coeff;
                if (options.oneofs)
                    object._turn_radius_thickness_coeff = "turn_radius_thickness_coeff";
            }
            if (message.turn_idle_smoothing_at_20hz != null && Object.hasOwnProperty.call(message, "turn_idle_smoothing_at_20hz")) {
                object.turn_idle_smoothing_at_20hz = options.json && !isFinite(message.turn_idle_smoothing_at_20hz) ? String(message.turn_idle_smoothing_at_20hz) : message.turn_idle_smoothing_at_20hz;
                if (options.oneofs)
                    object._turn_idle_smoothing_at_20hz = "turn_idle_smoothing_at_20hz";
            }
            if (message.turn_active_smoothing_at_20hz != null && Object.hasOwnProperty.call(message, "turn_active_smoothing_at_20hz")) {
                object.turn_active_smoothing_at_20hz = options.json && !isFinite(message.turn_active_smoothing_at_20hz) ? String(message.turn_active_smoothing_at_20hz) : message.turn_active_smoothing_at_20hz;
                if (options.oneofs)
                    object._turn_active_smoothing_at_20hz = "turn_active_smoothing_at_20hz";
            }
            return object;
        };

        /**
         * Converts this SimulationConfig to JSON.
         * @function toJSON
         * @memberof snake.SimulationConfig
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SimulationConfig.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SimulationConfig
         * @function getTypeUrl
         * @memberof snake.SimulationConfig
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SimulationConfig.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.SimulationConfig";
        };

        return SimulationConfig;
    })();

    snake.SnakeConfig = (function() {

        /**
         * Properties of a SnakeConfig.
         * @memberof snake
         * @interface ISnakeConfig
         * @property {number|null} [base_head_radius] SnakeConfig base_head_radius
         * @property {number|null} [score_thickness_scale] SnakeConfig score_thickness_scale
         * @property {number|null} [camera_zoom_out_coeff] SnakeConfig camera_zoom_out_coeff
         * @property {string|null} [growth_score_per_segment] SnakeConfig growth_score_per_segment
         * @property {number|null} [start_length] SnakeConfig start_length
         * @property {number|null} [start_score] SnakeConfig start_score
         * @property {number|null} [min_body_length] SnakeConfig min_body_length
         * @property {number|null} [safe_spawn_distance] SnakeConfig safe_spawn_distance
         * @property {number|null} [max_growth_score] SnakeConfig max_growth_score
         */

        /**
         * Constructs a new SnakeConfig.
         * @memberof snake
         * @classdesc Represents a SnakeConfig.
         * @implements ISnakeConfig
         * @constructor
         * @param {snake.ISnakeConfig=} [properties] Properties to set
         */
        function SnakeConfig(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * SnakeConfig base_head_radius.
         * @member {number|null|undefined} base_head_radius
         * @memberof snake.SnakeConfig
         * @instance
         */
        SnakeConfig.prototype.base_head_radius = null;

        /**
         * SnakeConfig score_thickness_scale.
         * @member {number|null|undefined} score_thickness_scale
         * @memberof snake.SnakeConfig
         * @instance
         */
        SnakeConfig.prototype.score_thickness_scale = null;

        /**
         * SnakeConfig camera_zoom_out_coeff.
         * @member {number|null|undefined} camera_zoom_out_coeff
         * @memberof snake.SnakeConfig
         * @instance
         */
        SnakeConfig.prototype.camera_zoom_out_coeff = null;

        /**
         * SnakeConfig growth_score_per_segment.
         * @member {string|null|undefined} growth_score_per_segment
         * @memberof snake.SnakeConfig
         * @instance
         */
        SnakeConfig.prototype.growth_score_per_segment = null;

        /**
         * SnakeConfig start_length.
         * @member {number|null|undefined} start_length
         * @memberof snake.SnakeConfig
         * @instance
         */
        SnakeConfig.prototype.start_length = null;

        /**
         * SnakeConfig start_score.
         * @member {number|null|undefined} start_score
         * @memberof snake.SnakeConfig
         * @instance
         */
        SnakeConfig.prototype.start_score = null;

        /**
         * SnakeConfig min_body_length.
         * @member {number|null|undefined} min_body_length
         * @memberof snake.SnakeConfig
         * @instance
         */
        SnakeConfig.prototype.min_body_length = null;

        /**
         * SnakeConfig safe_spawn_distance.
         * @member {number|null|undefined} safe_spawn_distance
         * @memberof snake.SnakeConfig
         * @instance
         */
        SnakeConfig.prototype.safe_spawn_distance = null;

        /**
         * SnakeConfig max_growth_score.
         * @member {number|null|undefined} max_growth_score
         * @memberof snake.SnakeConfig
         * @instance
         */
        SnakeConfig.prototype.max_growth_score = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SnakeConfig.prototype, "_base_head_radius", {
            get: $util.oneOfGetter($oneOfFields = ["base_head_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SnakeConfig.prototype, "_score_thickness_scale", {
            get: $util.oneOfGetter($oneOfFields = ["score_thickness_scale"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SnakeConfig.prototype, "_camera_zoom_out_coeff", {
            get: $util.oneOfGetter($oneOfFields = ["camera_zoom_out_coeff"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SnakeConfig.prototype, "_growth_score_per_segment", {
            get: $util.oneOfGetter($oneOfFields = ["growth_score_per_segment"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SnakeConfig.prototype, "_start_length", {
            get: $util.oneOfGetter($oneOfFields = ["start_length"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SnakeConfig.prototype, "_start_score", {
            get: $util.oneOfGetter($oneOfFields = ["start_score"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SnakeConfig.prototype, "_min_body_length", {
            get: $util.oneOfGetter($oneOfFields = ["min_body_length"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SnakeConfig.prototype, "_safe_spawn_distance", {
            get: $util.oneOfGetter($oneOfFields = ["safe_spawn_distance"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(SnakeConfig.prototype, "_max_growth_score", {
            get: $util.oneOfGetter($oneOfFields = ["max_growth_score"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new SnakeConfig instance using the specified properties.
         * @function create
         * @memberof snake.SnakeConfig
         * @static
         * @param {snake.ISnakeConfig=} [properties] Properties to set
         * @returns {snake.SnakeConfig} SnakeConfig instance
         */
        SnakeConfig.create = function create(properties) {
            return new SnakeConfig(properties);
        };

        /**
         * Encodes the specified SnakeConfig message. Does not implicitly {@link snake.SnakeConfig.verify|verify} messages.
         * @function encode
         * @memberof snake.SnakeConfig
         * @static
         * @param {snake.ISnakeConfig} message SnakeConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SnakeConfig.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.base_head_radius != null && Object.hasOwnProperty.call(message, "base_head_radius"))
                writer.uint32(/* id 1, wireType 5 =*/13).float(message.base_head_radius);
            if (message.score_thickness_scale != null && Object.hasOwnProperty.call(message, "score_thickness_scale"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.score_thickness_scale);
            if (message.camera_zoom_out_coeff != null && Object.hasOwnProperty.call(message, "camera_zoom_out_coeff"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.camera_zoom_out_coeff);
            if (message.growth_score_per_segment != null && Object.hasOwnProperty.call(message, "growth_score_per_segment"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.growth_score_per_segment);
            if (message.start_length != null && Object.hasOwnProperty.call(message, "start_length"))
                writer.uint32(/* id 5, wireType 0 =*/40).int32(message.start_length);
            if (message.start_score != null && Object.hasOwnProperty.call(message, "start_score"))
                writer.uint32(/* id 6, wireType 0 =*/48).int32(message.start_score);
            if (message.min_body_length != null && Object.hasOwnProperty.call(message, "min_body_length"))
                writer.uint32(/* id 7, wireType 0 =*/56).int32(message.min_body_length);
            if (message.safe_spawn_distance != null && Object.hasOwnProperty.call(message, "safe_spawn_distance"))
                writer.uint32(/* id 8, wireType 5 =*/69).float(message.safe_spawn_distance);
            if (message.max_growth_score != null && Object.hasOwnProperty.call(message, "max_growth_score"))
                writer.uint32(/* id 9, wireType 0 =*/72).int32(message.max_growth_score);
            return writer;
        };

        /**
         * Encodes the specified SnakeConfig message, length delimited. Does not implicitly {@link snake.SnakeConfig.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.SnakeConfig
         * @static
         * @param {snake.ISnakeConfig} message SnakeConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        SnakeConfig.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a SnakeConfig message from the specified reader or buffer.
         * @function decode
         * @memberof snake.SnakeConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.SnakeConfig} SnakeConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SnakeConfig.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.SnakeConfig();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.base_head_radius = reader.float();
                        break;
                    }
                case 2: {
                        message.score_thickness_scale = reader.float();
                        break;
                    }
                case 3: {
                        message.camera_zoom_out_coeff = reader.float();
                        break;
                    }
                case 4: {
                        message.growth_score_per_segment = reader.string();
                        break;
                    }
                case 5: {
                        message.start_length = reader.int32();
                        break;
                    }
                case 6: {
                        message.start_score = reader.int32();
                        break;
                    }
                case 7: {
                        message.min_body_length = reader.int32();
                        break;
                    }
                case 8: {
                        message.safe_spawn_distance = reader.float();
                        break;
                    }
                case 9: {
                        message.max_growth_score = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a SnakeConfig message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.SnakeConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.SnakeConfig} SnakeConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        SnakeConfig.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a SnakeConfig message.
         * @function verify
         * @memberof snake.SnakeConfig
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        SnakeConfig.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.base_head_radius != null && Object.hasOwnProperty.call(message, "base_head_radius")) {
                properties._base_head_radius = 1;
                if (typeof message.base_head_radius !== "number")
                    return "base_head_radius: number expected";
            }
            if (message.score_thickness_scale != null && Object.hasOwnProperty.call(message, "score_thickness_scale")) {
                properties._score_thickness_scale = 1;
                if (typeof message.score_thickness_scale !== "number")
                    return "score_thickness_scale: number expected";
            }
            if (message.camera_zoom_out_coeff != null && Object.hasOwnProperty.call(message, "camera_zoom_out_coeff")) {
                properties._camera_zoom_out_coeff = 1;
                if (typeof message.camera_zoom_out_coeff !== "number")
                    return "camera_zoom_out_coeff: number expected";
            }
            if (message.growth_score_per_segment != null && Object.hasOwnProperty.call(message, "growth_score_per_segment")) {
                properties._growth_score_per_segment = 1;
                if (!$util.isString(message.growth_score_per_segment))
                    return "growth_score_per_segment: string expected";
            }
            if (message.start_length != null && Object.hasOwnProperty.call(message, "start_length")) {
                properties._start_length = 1;
                if (!$util.isInteger(message.start_length))
                    return "start_length: integer expected";
            }
            if (message.start_score != null && Object.hasOwnProperty.call(message, "start_score")) {
                properties._start_score = 1;
                if (!$util.isInteger(message.start_score))
                    return "start_score: integer expected";
            }
            if (message.min_body_length != null && Object.hasOwnProperty.call(message, "min_body_length")) {
                properties._min_body_length = 1;
                if (!$util.isInteger(message.min_body_length))
                    return "min_body_length: integer expected";
            }
            if (message.safe_spawn_distance != null && Object.hasOwnProperty.call(message, "safe_spawn_distance")) {
                properties._safe_spawn_distance = 1;
                if (typeof message.safe_spawn_distance !== "number")
                    return "safe_spawn_distance: number expected";
            }
            if (message.max_growth_score != null && Object.hasOwnProperty.call(message, "max_growth_score")) {
                properties._max_growth_score = 1;
                if (!$util.isInteger(message.max_growth_score))
                    return "max_growth_score: integer expected";
            }
            return null;
        };

        /**
         * Creates a SnakeConfig message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.SnakeConfig
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.SnakeConfig} SnakeConfig
         */
        SnakeConfig.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.SnakeConfig)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.SnakeConfig: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.SnakeConfig();
            if (object.base_head_radius != null)
                message.base_head_radius = Number(object.base_head_radius);
            if (object.score_thickness_scale != null)
                message.score_thickness_scale = Number(object.score_thickness_scale);
            if (object.camera_zoom_out_coeff != null)
                message.camera_zoom_out_coeff = Number(object.camera_zoom_out_coeff);
            if (object.growth_score_per_segment != null)
                message.growth_score_per_segment = String(object.growth_score_per_segment);
            if (object.start_length != null)
                message.start_length = object.start_length | 0;
            if (object.start_score != null)
                message.start_score = object.start_score | 0;
            if (object.min_body_length != null)
                message.min_body_length = object.min_body_length | 0;
            if (object.safe_spawn_distance != null)
                message.safe_spawn_distance = Number(object.safe_spawn_distance);
            if (object.max_growth_score != null)
                message.max_growth_score = object.max_growth_score | 0;
            return message;
        };

        /**
         * Creates a plain object from a SnakeConfig message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.SnakeConfig
         * @static
         * @param {snake.SnakeConfig} message SnakeConfig
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        SnakeConfig.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.base_head_radius != null && Object.hasOwnProperty.call(message, "base_head_radius")) {
                object.base_head_radius = options.json && !isFinite(message.base_head_radius) ? String(message.base_head_radius) : message.base_head_radius;
                if (options.oneofs)
                    object._base_head_radius = "base_head_radius";
            }
            if (message.score_thickness_scale != null && Object.hasOwnProperty.call(message, "score_thickness_scale")) {
                object.score_thickness_scale = options.json && !isFinite(message.score_thickness_scale) ? String(message.score_thickness_scale) : message.score_thickness_scale;
                if (options.oneofs)
                    object._score_thickness_scale = "score_thickness_scale";
            }
            if (message.camera_zoom_out_coeff != null && Object.hasOwnProperty.call(message, "camera_zoom_out_coeff")) {
                object.camera_zoom_out_coeff = options.json && !isFinite(message.camera_zoom_out_coeff) ? String(message.camera_zoom_out_coeff) : message.camera_zoom_out_coeff;
                if (options.oneofs)
                    object._camera_zoom_out_coeff = "camera_zoom_out_coeff";
            }
            if (message.growth_score_per_segment != null && Object.hasOwnProperty.call(message, "growth_score_per_segment")) {
                object.growth_score_per_segment = message.growth_score_per_segment;
                if (options.oneofs)
                    object._growth_score_per_segment = "growth_score_per_segment";
            }
            if (message.start_length != null && Object.hasOwnProperty.call(message, "start_length")) {
                object.start_length = message.start_length;
                if (options.oneofs)
                    object._start_length = "start_length";
            }
            if (message.start_score != null && Object.hasOwnProperty.call(message, "start_score")) {
                object.start_score = message.start_score;
                if (options.oneofs)
                    object._start_score = "start_score";
            }
            if (message.min_body_length != null && Object.hasOwnProperty.call(message, "min_body_length")) {
                object.min_body_length = message.min_body_length;
                if (options.oneofs)
                    object._min_body_length = "min_body_length";
            }
            if (message.safe_spawn_distance != null && Object.hasOwnProperty.call(message, "safe_spawn_distance")) {
                object.safe_spawn_distance = options.json && !isFinite(message.safe_spawn_distance) ? String(message.safe_spawn_distance) : message.safe_spawn_distance;
                if (options.oneofs)
                    object._safe_spawn_distance = "safe_spawn_distance";
            }
            if (message.max_growth_score != null && Object.hasOwnProperty.call(message, "max_growth_score")) {
                object.max_growth_score = message.max_growth_score;
                if (options.oneofs)
                    object._max_growth_score = "max_growth_score";
            }
            return object;
        };

        /**
         * Converts this SnakeConfig to JSON.
         * @function toJSON
         * @memberof snake.SnakeConfig
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        SnakeConfig.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for SnakeConfig
         * @function getTypeUrl
         * @memberof snake.SnakeConfig
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        SnakeConfig.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.SnakeConfig";
        };

        return SnakeConfig;
    })();

    snake.VisualConfig = (function() {

        /**
         * Properties of a VisualConfig.
         * @memberof snake
         * @interface IVisualConfig
         * @property {number|null} [min_fog_radius] VisualConfig min_fog_radius
         * @property {number|null} [fog_score_expansion_coeff] VisualConfig fog_score_expansion_coeff
         * @property {number|null} [camera_base_zoom] VisualConfig camera_base_zoom
         * @property {number|null} [camera_pitch_angle] VisualConfig camera_pitch_angle
         * @property {number|null} [camera_z_height] VisualConfig camera_z_height
         * @property {number|null} [camera_y_offset] VisualConfig camera_y_offset
         * @property {number|null} [mouse_sensitivity] VisualConfig mouse_sensitivity
         * @property {number|null} [head_glow_radius] VisualConfig head_glow_radius
         */

        /**
         * Constructs a new VisualConfig.
         * @memberof snake
         * @classdesc Represents a VisualConfig.
         * @implements IVisualConfig
         * @constructor
         * @param {snake.IVisualConfig=} [properties] Properties to set
         */
        function VisualConfig(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * VisualConfig min_fog_radius.
         * @member {number|null|undefined} min_fog_radius
         * @memberof snake.VisualConfig
         * @instance
         */
        VisualConfig.prototype.min_fog_radius = null;

        /**
         * VisualConfig fog_score_expansion_coeff.
         * @member {number|null|undefined} fog_score_expansion_coeff
         * @memberof snake.VisualConfig
         * @instance
         */
        VisualConfig.prototype.fog_score_expansion_coeff = null;

        /**
         * VisualConfig camera_base_zoom.
         * @member {number|null|undefined} camera_base_zoom
         * @memberof snake.VisualConfig
         * @instance
         */
        VisualConfig.prototype.camera_base_zoom = null;

        /**
         * VisualConfig camera_pitch_angle.
         * @member {number|null|undefined} camera_pitch_angle
         * @memberof snake.VisualConfig
         * @instance
         */
        VisualConfig.prototype.camera_pitch_angle = null;

        /**
         * VisualConfig camera_z_height.
         * @member {number|null|undefined} camera_z_height
         * @memberof snake.VisualConfig
         * @instance
         */
        VisualConfig.prototype.camera_z_height = null;

        /**
         * VisualConfig camera_y_offset.
         * @member {number|null|undefined} camera_y_offset
         * @memberof snake.VisualConfig
         * @instance
         */
        VisualConfig.prototype.camera_y_offset = null;

        /**
         * VisualConfig mouse_sensitivity.
         * @member {number|null|undefined} mouse_sensitivity
         * @memberof snake.VisualConfig
         * @instance
         */
        VisualConfig.prototype.mouse_sensitivity = null;

        /**
         * VisualConfig head_glow_radius.
         * @member {number|null|undefined} head_glow_radius
         * @memberof snake.VisualConfig
         * @instance
         */
        VisualConfig.prototype.head_glow_radius = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(VisualConfig.prototype, "_min_fog_radius", {
            get: $util.oneOfGetter($oneOfFields = ["min_fog_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(VisualConfig.prototype, "_fog_score_expansion_coeff", {
            get: $util.oneOfGetter($oneOfFields = ["fog_score_expansion_coeff"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(VisualConfig.prototype, "_camera_base_zoom", {
            get: $util.oneOfGetter($oneOfFields = ["camera_base_zoom"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(VisualConfig.prototype, "_camera_pitch_angle", {
            get: $util.oneOfGetter($oneOfFields = ["camera_pitch_angle"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(VisualConfig.prototype, "_camera_z_height", {
            get: $util.oneOfGetter($oneOfFields = ["camera_z_height"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(VisualConfig.prototype, "_camera_y_offset", {
            get: $util.oneOfGetter($oneOfFields = ["camera_y_offset"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(VisualConfig.prototype, "_mouse_sensitivity", {
            get: $util.oneOfGetter($oneOfFields = ["mouse_sensitivity"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(VisualConfig.prototype, "_head_glow_radius", {
            get: $util.oneOfGetter($oneOfFields = ["head_glow_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new VisualConfig instance using the specified properties.
         * @function create
         * @memberof snake.VisualConfig
         * @static
         * @param {snake.IVisualConfig=} [properties] Properties to set
         * @returns {snake.VisualConfig} VisualConfig instance
         */
        VisualConfig.create = function create(properties) {
            return new VisualConfig(properties);
        };

        /**
         * Encodes the specified VisualConfig message. Does not implicitly {@link snake.VisualConfig.verify|verify} messages.
         * @function encode
         * @memberof snake.VisualConfig
         * @static
         * @param {snake.IVisualConfig} message VisualConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        VisualConfig.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.min_fog_radius != null && Object.hasOwnProperty.call(message, "min_fog_radius"))
                writer.uint32(/* id 1, wireType 5 =*/13).float(message.min_fog_radius);
            if (message.fog_score_expansion_coeff != null && Object.hasOwnProperty.call(message, "fog_score_expansion_coeff"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.fog_score_expansion_coeff);
            if (message.camera_base_zoom != null && Object.hasOwnProperty.call(message, "camera_base_zoom"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.camera_base_zoom);
            if (message.camera_pitch_angle != null && Object.hasOwnProperty.call(message, "camera_pitch_angle"))
                writer.uint32(/* id 4, wireType 5 =*/37).float(message.camera_pitch_angle);
            if (message.camera_z_height != null && Object.hasOwnProperty.call(message, "camera_z_height"))
                writer.uint32(/* id 5, wireType 5 =*/45).float(message.camera_z_height);
            if (message.camera_y_offset != null && Object.hasOwnProperty.call(message, "camera_y_offset"))
                writer.uint32(/* id 6, wireType 5 =*/53).float(message.camera_y_offset);
            if (message.mouse_sensitivity != null && Object.hasOwnProperty.call(message, "mouse_sensitivity"))
                writer.uint32(/* id 7, wireType 5 =*/61).float(message.mouse_sensitivity);
            if (message.head_glow_radius != null && Object.hasOwnProperty.call(message, "head_glow_radius"))
                writer.uint32(/* id 8, wireType 5 =*/69).float(message.head_glow_radius);
            return writer;
        };

        /**
         * Encodes the specified VisualConfig message, length delimited. Does not implicitly {@link snake.VisualConfig.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.VisualConfig
         * @static
         * @param {snake.IVisualConfig} message VisualConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        VisualConfig.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a VisualConfig message from the specified reader or buffer.
         * @function decode
         * @memberof snake.VisualConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.VisualConfig} VisualConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        VisualConfig.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.VisualConfig();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.min_fog_radius = reader.float();
                        break;
                    }
                case 2: {
                        message.fog_score_expansion_coeff = reader.float();
                        break;
                    }
                case 3: {
                        message.camera_base_zoom = reader.float();
                        break;
                    }
                case 4: {
                        message.camera_pitch_angle = reader.float();
                        break;
                    }
                case 5: {
                        message.camera_z_height = reader.float();
                        break;
                    }
                case 6: {
                        message.camera_y_offset = reader.float();
                        break;
                    }
                case 7: {
                        message.mouse_sensitivity = reader.float();
                        break;
                    }
                case 8: {
                        message.head_glow_radius = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a VisualConfig message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.VisualConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.VisualConfig} VisualConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        VisualConfig.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a VisualConfig message.
         * @function verify
         * @memberof snake.VisualConfig
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        VisualConfig.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.min_fog_radius != null && Object.hasOwnProperty.call(message, "min_fog_radius")) {
                properties._min_fog_radius = 1;
                if (typeof message.min_fog_radius !== "number")
                    return "min_fog_radius: number expected";
            }
            if (message.fog_score_expansion_coeff != null && Object.hasOwnProperty.call(message, "fog_score_expansion_coeff")) {
                properties._fog_score_expansion_coeff = 1;
                if (typeof message.fog_score_expansion_coeff !== "number")
                    return "fog_score_expansion_coeff: number expected";
            }
            if (message.camera_base_zoom != null && Object.hasOwnProperty.call(message, "camera_base_zoom")) {
                properties._camera_base_zoom = 1;
                if (typeof message.camera_base_zoom !== "number")
                    return "camera_base_zoom: number expected";
            }
            if (message.camera_pitch_angle != null && Object.hasOwnProperty.call(message, "camera_pitch_angle")) {
                properties._camera_pitch_angle = 1;
                if (typeof message.camera_pitch_angle !== "number")
                    return "camera_pitch_angle: number expected";
            }
            if (message.camera_z_height != null && Object.hasOwnProperty.call(message, "camera_z_height")) {
                properties._camera_z_height = 1;
                if (typeof message.camera_z_height !== "number")
                    return "camera_z_height: number expected";
            }
            if (message.camera_y_offset != null && Object.hasOwnProperty.call(message, "camera_y_offset")) {
                properties._camera_y_offset = 1;
                if (typeof message.camera_y_offset !== "number")
                    return "camera_y_offset: number expected";
            }
            if (message.mouse_sensitivity != null && Object.hasOwnProperty.call(message, "mouse_sensitivity")) {
                properties._mouse_sensitivity = 1;
                if (typeof message.mouse_sensitivity !== "number")
                    return "mouse_sensitivity: number expected";
            }
            if (message.head_glow_radius != null && Object.hasOwnProperty.call(message, "head_glow_radius")) {
                properties._head_glow_radius = 1;
                if (typeof message.head_glow_radius !== "number")
                    return "head_glow_radius: number expected";
            }
            return null;
        };

        /**
         * Creates a VisualConfig message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.VisualConfig
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.VisualConfig} VisualConfig
         */
        VisualConfig.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.VisualConfig)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.VisualConfig: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.VisualConfig();
            if (object.min_fog_radius != null)
                message.min_fog_radius = Number(object.min_fog_radius);
            if (object.fog_score_expansion_coeff != null)
                message.fog_score_expansion_coeff = Number(object.fog_score_expansion_coeff);
            if (object.camera_base_zoom != null)
                message.camera_base_zoom = Number(object.camera_base_zoom);
            if (object.camera_pitch_angle != null)
                message.camera_pitch_angle = Number(object.camera_pitch_angle);
            if (object.camera_z_height != null)
                message.camera_z_height = Number(object.camera_z_height);
            if (object.camera_y_offset != null)
                message.camera_y_offset = Number(object.camera_y_offset);
            if (object.mouse_sensitivity != null)
                message.mouse_sensitivity = Number(object.mouse_sensitivity);
            if (object.head_glow_radius != null)
                message.head_glow_radius = Number(object.head_glow_radius);
            return message;
        };

        /**
         * Creates a plain object from a VisualConfig message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.VisualConfig
         * @static
         * @param {snake.VisualConfig} message VisualConfig
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        VisualConfig.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.min_fog_radius != null && Object.hasOwnProperty.call(message, "min_fog_radius")) {
                object.min_fog_radius = options.json && !isFinite(message.min_fog_radius) ? String(message.min_fog_radius) : message.min_fog_radius;
                if (options.oneofs)
                    object._min_fog_radius = "min_fog_radius";
            }
            if (message.fog_score_expansion_coeff != null && Object.hasOwnProperty.call(message, "fog_score_expansion_coeff")) {
                object.fog_score_expansion_coeff = options.json && !isFinite(message.fog_score_expansion_coeff) ? String(message.fog_score_expansion_coeff) : message.fog_score_expansion_coeff;
                if (options.oneofs)
                    object._fog_score_expansion_coeff = "fog_score_expansion_coeff";
            }
            if (message.camera_base_zoom != null && Object.hasOwnProperty.call(message, "camera_base_zoom")) {
                object.camera_base_zoom = options.json && !isFinite(message.camera_base_zoom) ? String(message.camera_base_zoom) : message.camera_base_zoom;
                if (options.oneofs)
                    object._camera_base_zoom = "camera_base_zoom";
            }
            if (message.camera_pitch_angle != null && Object.hasOwnProperty.call(message, "camera_pitch_angle")) {
                object.camera_pitch_angle = options.json && !isFinite(message.camera_pitch_angle) ? String(message.camera_pitch_angle) : message.camera_pitch_angle;
                if (options.oneofs)
                    object._camera_pitch_angle = "camera_pitch_angle";
            }
            if (message.camera_z_height != null && Object.hasOwnProperty.call(message, "camera_z_height")) {
                object.camera_z_height = options.json && !isFinite(message.camera_z_height) ? String(message.camera_z_height) : message.camera_z_height;
                if (options.oneofs)
                    object._camera_z_height = "camera_z_height";
            }
            if (message.camera_y_offset != null && Object.hasOwnProperty.call(message, "camera_y_offset")) {
                object.camera_y_offset = options.json && !isFinite(message.camera_y_offset) ? String(message.camera_y_offset) : message.camera_y_offset;
                if (options.oneofs)
                    object._camera_y_offset = "camera_y_offset";
            }
            if (message.mouse_sensitivity != null && Object.hasOwnProperty.call(message, "mouse_sensitivity")) {
                object.mouse_sensitivity = options.json && !isFinite(message.mouse_sensitivity) ? String(message.mouse_sensitivity) : message.mouse_sensitivity;
                if (options.oneofs)
                    object._mouse_sensitivity = "mouse_sensitivity";
            }
            if (message.head_glow_radius != null && Object.hasOwnProperty.call(message, "head_glow_radius")) {
                object.head_glow_radius = options.json && !isFinite(message.head_glow_radius) ? String(message.head_glow_radius) : message.head_glow_radius;
                if (options.oneofs)
                    object._head_glow_radius = "head_glow_radius";
            }
            return object;
        };

        /**
         * Converts this VisualConfig to JSON.
         * @function toJSON
         * @memberof snake.VisualConfig
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        VisualConfig.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for VisualConfig
         * @function getTypeUrl
         * @memberof snake.VisualConfig
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        VisualConfig.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.VisualConfig";
        };

        return VisualConfig;
    })();

    snake.FoodTypeConfig = (function() {

        /**
         * Properties of a FoodTypeConfig.
         * @memberof snake
         * @interface IFoodTypeConfig
         * @property {number|null} [value] FoodTypeConfig value
         * @property {number|null} [weight] FoodTypeConfig weight
         * @property {string|null} [color] FoodTypeConfig color
         * @property {string|null} [image] FoodTypeConfig image
         */

        /**
         * Constructs a new FoodTypeConfig.
         * @memberof snake
         * @classdesc Represents a FoodTypeConfig.
         * @implements IFoodTypeConfig
         * @constructor
         * @param {snake.IFoodTypeConfig=} [properties] Properties to set
         */
        function FoodTypeConfig(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * FoodTypeConfig value.
         * @member {number|null|undefined} value
         * @memberof snake.FoodTypeConfig
         * @instance
         */
        FoodTypeConfig.prototype.value = null;

        /**
         * FoodTypeConfig weight.
         * @member {number|null|undefined} weight
         * @memberof snake.FoodTypeConfig
         * @instance
         */
        FoodTypeConfig.prototype.weight = null;

        /**
         * FoodTypeConfig color.
         * @member {string|null|undefined} color
         * @memberof snake.FoodTypeConfig
         * @instance
         */
        FoodTypeConfig.prototype.color = null;

        /**
         * FoodTypeConfig image.
         * @member {string|null|undefined} image
         * @memberof snake.FoodTypeConfig
         * @instance
         */
        FoodTypeConfig.prototype.image = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FoodTypeConfig.prototype, "_value", {
            get: $util.oneOfGetter($oneOfFields = ["value"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FoodTypeConfig.prototype, "_weight", {
            get: $util.oneOfGetter($oneOfFields = ["weight"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FoodTypeConfig.prototype, "_color", {
            get: $util.oneOfGetter($oneOfFields = ["color"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FoodTypeConfig.prototype, "_image", {
            get: $util.oneOfGetter($oneOfFields = ["image"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new FoodTypeConfig instance using the specified properties.
         * @function create
         * @memberof snake.FoodTypeConfig
         * @static
         * @param {snake.IFoodTypeConfig=} [properties] Properties to set
         * @returns {snake.FoodTypeConfig} FoodTypeConfig instance
         */
        FoodTypeConfig.create = function create(properties) {
            return new FoodTypeConfig(properties);
        };

        /**
         * Encodes the specified FoodTypeConfig message. Does not implicitly {@link snake.FoodTypeConfig.verify|verify} messages.
         * @function encode
         * @memberof snake.FoodTypeConfig
         * @static
         * @param {snake.IFoodTypeConfig} message FoodTypeConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodTypeConfig.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.value);
            if (message.weight != null && Object.hasOwnProperty.call(message, "weight"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.weight);
            if (message.color != null && Object.hasOwnProperty.call(message, "color"))
                writer.uint32(/* id 3, wireType 2 =*/26).string(message.color);
            if (message.image != null && Object.hasOwnProperty.call(message, "image"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.image);
            return writer;
        };

        /**
         * Encodes the specified FoodTypeConfig message, length delimited. Does not implicitly {@link snake.FoodTypeConfig.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.FoodTypeConfig
         * @static
         * @param {snake.IFoodTypeConfig} message FoodTypeConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodTypeConfig.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a FoodTypeConfig message from the specified reader or buffer.
         * @function decode
         * @memberof snake.FoodTypeConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.FoodTypeConfig} FoodTypeConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodTypeConfig.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.FoodTypeConfig();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.value = reader.int32();
                        break;
                    }
                case 2: {
                        message.weight = reader.int32();
                        break;
                    }
                case 3: {
                        message.color = reader.string();
                        break;
                    }
                case 4: {
                        message.image = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a FoodTypeConfig message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.FoodTypeConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.FoodTypeConfig} FoodTypeConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodTypeConfig.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a FoodTypeConfig message.
         * @function verify
         * @memberof snake.FoodTypeConfig
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        FoodTypeConfig.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.value != null && Object.hasOwnProperty.call(message, "value")) {
                properties._value = 1;
                if (!$util.isInteger(message.value))
                    return "value: integer expected";
            }
            if (message.weight != null && Object.hasOwnProperty.call(message, "weight")) {
                properties._weight = 1;
                if (!$util.isInteger(message.weight))
                    return "weight: integer expected";
            }
            if (message.color != null && Object.hasOwnProperty.call(message, "color")) {
                properties._color = 1;
                if (!$util.isString(message.color))
                    return "color: string expected";
            }
            if (message.image != null && Object.hasOwnProperty.call(message, "image")) {
                properties._image = 1;
                if (!$util.isString(message.image))
                    return "image: string expected";
            }
            return null;
        };

        /**
         * Creates a FoodTypeConfig message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.FoodTypeConfig
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.FoodTypeConfig} FoodTypeConfig
         */
        FoodTypeConfig.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.FoodTypeConfig)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.FoodTypeConfig: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.FoodTypeConfig();
            if (object.value != null)
                message.value = object.value | 0;
            if (object.weight != null)
                message.weight = object.weight | 0;
            if (object.color != null)
                message.color = String(object.color);
            if (object.image != null)
                message.image = String(object.image);
            return message;
        };

        /**
         * Creates a plain object from a FoodTypeConfig message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.FoodTypeConfig
         * @static
         * @param {snake.FoodTypeConfig} message FoodTypeConfig
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        FoodTypeConfig.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.value != null && Object.hasOwnProperty.call(message, "value")) {
                object.value = message.value;
                if (options.oneofs)
                    object._value = "value";
            }
            if (message.weight != null && Object.hasOwnProperty.call(message, "weight")) {
                object.weight = message.weight;
                if (options.oneofs)
                    object._weight = "weight";
            }
            if (message.color != null && Object.hasOwnProperty.call(message, "color")) {
                object.color = message.color;
                if (options.oneofs)
                    object._color = "color";
            }
            if (message.image != null && Object.hasOwnProperty.call(message, "image")) {
                object.image = message.image;
                if (options.oneofs)
                    object._image = "image";
            }
            return object;
        };

        /**
         * Converts this FoodTypeConfig to JSON.
         * @function toJSON
         * @memberof snake.FoodTypeConfig
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        FoodTypeConfig.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for FoodTypeConfig
         * @function getTypeUrl
         * @memberof snake.FoodTypeConfig
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        FoodTypeConfig.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.FoodTypeConfig";
        };

        return FoodTypeConfig;
    })();

    snake.FoodConfig = (function() {

        /**
         * Properties of a FoodConfig.
         * @memberof snake
         * @interface IFoodConfig
         * @property {Array.<snake.IFoodTypeConfig>|null} [types] FoodConfig types
         * @property {number|null} [base_radius] FoodConfig base_radius
         * @property {number|null} [radius_value_scale] FoodConfig radius_value_scale
         * @property {number|null} [death_drop_score_fraction] FoodConfig death_drop_score_fraction
         * @property {number|null} [attraction_radius] FoodConfig attraction_radius
         * @property {number|null} [attraction_speed] FoodConfig attraction_speed
         */

        /**
         * Constructs a new FoodConfig.
         * @memberof snake
         * @classdesc Represents a FoodConfig.
         * @implements IFoodConfig
         * @constructor
         * @param {snake.IFoodConfig=} [properties] Properties to set
         */
        function FoodConfig(properties) {
            this.types = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * FoodConfig types.
         * @member {Array.<snake.IFoodTypeConfig>} types
         * @memberof snake.FoodConfig
         * @instance
         */
        FoodConfig.prototype.types = $util.emptyArray;

        /**
         * FoodConfig base_radius.
         * @member {number|null|undefined} base_radius
         * @memberof snake.FoodConfig
         * @instance
         */
        FoodConfig.prototype.base_radius = null;

        /**
         * FoodConfig radius_value_scale.
         * @member {number|null|undefined} radius_value_scale
         * @memberof snake.FoodConfig
         * @instance
         */
        FoodConfig.prototype.radius_value_scale = null;

        /**
         * FoodConfig death_drop_score_fraction.
         * @member {number|null|undefined} death_drop_score_fraction
         * @memberof snake.FoodConfig
         * @instance
         */
        FoodConfig.prototype.death_drop_score_fraction = null;

        /**
         * FoodConfig attraction_radius.
         * @member {number|null|undefined} attraction_radius
         * @memberof snake.FoodConfig
         * @instance
         */
        FoodConfig.prototype.attraction_radius = null;

        /**
         * FoodConfig attraction_speed.
         * @member {number|null|undefined} attraction_speed
         * @memberof snake.FoodConfig
         * @instance
         */
        FoodConfig.prototype.attraction_speed = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FoodConfig.prototype, "_base_radius", {
            get: $util.oneOfGetter($oneOfFields = ["base_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FoodConfig.prototype, "_radius_value_scale", {
            get: $util.oneOfGetter($oneOfFields = ["radius_value_scale"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FoodConfig.prototype, "_death_drop_score_fraction", {
            get: $util.oneOfGetter($oneOfFields = ["death_drop_score_fraction"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FoodConfig.prototype, "_attraction_radius", {
            get: $util.oneOfGetter($oneOfFields = ["attraction_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(FoodConfig.prototype, "_attraction_speed", {
            get: $util.oneOfGetter($oneOfFields = ["attraction_speed"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new FoodConfig instance using the specified properties.
         * @function create
         * @memberof snake.FoodConfig
         * @static
         * @param {snake.IFoodConfig=} [properties] Properties to set
         * @returns {snake.FoodConfig} FoodConfig instance
         */
        FoodConfig.create = function create(properties) {
            return new FoodConfig(properties);
        };

        /**
         * Encodes the specified FoodConfig message. Does not implicitly {@link snake.FoodConfig.verify|verify} messages.
         * @function encode
         * @memberof snake.FoodConfig
         * @static
         * @param {snake.IFoodConfig} message FoodConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodConfig.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.types != null && message.types.length)
                for (let i = 0; i < message.types.length; ++i)
                    $root.snake.FoodTypeConfig.encode(message.types[i], writer.uint32(/* id 1, wireType 2 =*/10).fork(), q + 1).ldelim();
            if (message.base_radius != null && Object.hasOwnProperty.call(message, "base_radius"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.base_radius);
            if (message.radius_value_scale != null && Object.hasOwnProperty.call(message, "radius_value_scale"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.radius_value_scale);
            if (message.death_drop_score_fraction != null && Object.hasOwnProperty.call(message, "death_drop_score_fraction"))
                writer.uint32(/* id 4, wireType 5 =*/37).float(message.death_drop_score_fraction);
            if (message.attraction_radius != null && Object.hasOwnProperty.call(message, "attraction_radius"))
                writer.uint32(/* id 5, wireType 5 =*/45).float(message.attraction_radius);
            if (message.attraction_speed != null && Object.hasOwnProperty.call(message, "attraction_speed"))
                writer.uint32(/* id 6, wireType 5 =*/53).float(message.attraction_speed);
            return writer;
        };

        /**
         * Encodes the specified FoodConfig message, length delimited. Does not implicitly {@link snake.FoodConfig.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.FoodConfig
         * @static
         * @param {snake.IFoodConfig} message FoodConfig message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        FoodConfig.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a FoodConfig message from the specified reader or buffer.
         * @function decode
         * @memberof snake.FoodConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.FoodConfig} FoodConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodConfig.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.FoodConfig();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        if (!(message.types && message.types.length))
                            message.types = [];
                        message.types.push($root.snake.FoodTypeConfig.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 2: {
                        message.base_radius = reader.float();
                        break;
                    }
                case 3: {
                        message.radius_value_scale = reader.float();
                        break;
                    }
                case 4: {
                        message.death_drop_score_fraction = reader.float();
                        break;
                    }
                case 5: {
                        message.attraction_radius = reader.float();
                        break;
                    }
                case 6: {
                        message.attraction_speed = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a FoodConfig message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.FoodConfig
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.FoodConfig} FoodConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        FoodConfig.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a FoodConfig message.
         * @function verify
         * @memberof snake.FoodConfig
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        FoodConfig.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.types != null && Object.hasOwnProperty.call(message, "types")) {
                if (!Array.isArray(message.types))
                    return "types: array expected";
                for (let i = 0; i < message.types.length; ++i) {
                    let error = $root.snake.FoodTypeConfig.verify(message.types[i], long + 1);
                    if (error)
                        return "types." + error;
                }
            }
            if (message.base_radius != null && Object.hasOwnProperty.call(message, "base_radius")) {
                properties._base_radius = 1;
                if (typeof message.base_radius !== "number")
                    return "base_radius: number expected";
            }
            if (message.radius_value_scale != null && Object.hasOwnProperty.call(message, "radius_value_scale")) {
                properties._radius_value_scale = 1;
                if (typeof message.radius_value_scale !== "number")
                    return "radius_value_scale: number expected";
            }
            if (message.death_drop_score_fraction != null && Object.hasOwnProperty.call(message, "death_drop_score_fraction")) {
                properties._death_drop_score_fraction = 1;
                if (typeof message.death_drop_score_fraction !== "number")
                    return "death_drop_score_fraction: number expected";
            }
            if (message.attraction_radius != null && Object.hasOwnProperty.call(message, "attraction_radius")) {
                properties._attraction_radius = 1;
                if (typeof message.attraction_radius !== "number")
                    return "attraction_radius: number expected";
            }
            if (message.attraction_speed != null && Object.hasOwnProperty.call(message, "attraction_speed")) {
                properties._attraction_speed = 1;
                if (typeof message.attraction_speed !== "number")
                    return "attraction_speed: number expected";
            }
            return null;
        };

        /**
         * Creates a FoodConfig message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.FoodConfig
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.FoodConfig} FoodConfig
         */
        FoodConfig.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.FoodConfig)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.FoodConfig: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.FoodConfig();
            if (object.types) {
                if (!Array.isArray(object.types))
                    throw TypeError(".snake.FoodConfig.types: array expected");
                message.types = [];
                for (let i = 0; i < object.types.length; ++i) {
                    if (!$util.isObject(object.types[i]))
                        throw TypeError(".snake.FoodConfig.types: object expected");
                    message.types[i] = $root.snake.FoodTypeConfig.fromObject(object.types[i], long + 1);
                }
            }
            if (object.base_radius != null)
                message.base_radius = Number(object.base_radius);
            if (object.radius_value_scale != null)
                message.radius_value_scale = Number(object.radius_value_scale);
            if (object.death_drop_score_fraction != null)
                message.death_drop_score_fraction = Number(object.death_drop_score_fraction);
            if (object.attraction_radius != null)
                message.attraction_radius = Number(object.attraction_radius);
            if (object.attraction_speed != null)
                message.attraction_speed = Number(object.attraction_speed);
            return message;
        };

        /**
         * Creates a plain object from a FoodConfig message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.FoodConfig
         * @static
         * @param {snake.FoodConfig} message FoodConfig
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        FoodConfig.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults)
                object.types = [];
            if (message.types && message.types.length) {
                object.types = [];
                for (let j = 0; j < message.types.length; ++j)
                    object.types[j] = $root.snake.FoodTypeConfig.toObject(message.types[j], options, q + 1);
            }
            if (message.base_radius != null && Object.hasOwnProperty.call(message, "base_radius")) {
                object.base_radius = options.json && !isFinite(message.base_radius) ? String(message.base_radius) : message.base_radius;
                if (options.oneofs)
                    object._base_radius = "base_radius";
            }
            if (message.radius_value_scale != null && Object.hasOwnProperty.call(message, "radius_value_scale")) {
                object.radius_value_scale = options.json && !isFinite(message.radius_value_scale) ? String(message.radius_value_scale) : message.radius_value_scale;
                if (options.oneofs)
                    object._radius_value_scale = "radius_value_scale";
            }
            if (message.death_drop_score_fraction != null && Object.hasOwnProperty.call(message, "death_drop_score_fraction")) {
                object.death_drop_score_fraction = options.json && !isFinite(message.death_drop_score_fraction) ? String(message.death_drop_score_fraction) : message.death_drop_score_fraction;
                if (options.oneofs)
                    object._death_drop_score_fraction = "death_drop_score_fraction";
            }
            if (message.attraction_radius != null && Object.hasOwnProperty.call(message, "attraction_radius")) {
                object.attraction_radius = options.json && !isFinite(message.attraction_radius) ? String(message.attraction_radius) : message.attraction_radius;
                if (options.oneofs)
                    object._attraction_radius = "attraction_radius";
            }
            if (message.attraction_speed != null && Object.hasOwnProperty.call(message, "attraction_speed")) {
                object.attraction_speed = options.json && !isFinite(message.attraction_speed) ? String(message.attraction_speed) : message.attraction_speed;
                if (options.oneofs)
                    object._attraction_speed = "attraction_speed";
            }
            return object;
        };

        /**
         * Converts this FoodConfig to JSON.
         * @function toJSON
         * @memberof snake.FoodConfig
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        FoodConfig.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for FoodConfig
         * @function getTypeUrl
         * @memberof snake.FoodConfig
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        FoodConfig.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.FoodConfig";
        };

        return FoodConfig;
    })();

    snake.Food = (function() {

        /**
         * Properties of a Food.
         * @memberof snake
         * @interface IFood
         * @property {number|null} [id] Food id
         * @property {number|null} [x] Food x
         * @property {number|null} [y] Food y
         * @property {number|null} [value] Food value
         * @property {string|null} [color] Food color
         * @property {string|null} [image] Food image
         */

        /**
         * Constructs a new Food.
         * @memberof snake
         * @classdesc Represents a Food.
         * @implements IFood
         * @constructor
         * @param {snake.IFood=} [properties] Properties to set
         */
        function Food(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Food id.
         * @member {number|null|undefined} id
         * @memberof snake.Food
         * @instance
         */
        Food.prototype.id = null;

        /**
         * Food x.
         * @member {number|null|undefined} x
         * @memberof snake.Food
         * @instance
         */
        Food.prototype.x = null;

        /**
         * Food y.
         * @member {number|null|undefined} y
         * @memberof snake.Food
         * @instance
         */
        Food.prototype.y = null;

        /**
         * Food value.
         * @member {number|null|undefined} value
         * @memberof snake.Food
         * @instance
         */
        Food.prototype.value = null;

        /**
         * Food color.
         * @member {string|null|undefined} color
         * @memberof snake.Food
         * @instance
         */
        Food.prototype.color = null;

        /**
         * Food image.
         * @member {string|null|undefined} image
         * @memberof snake.Food
         * @instance
         */
        Food.prototype.image = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Food.prototype, "_id", {
            get: $util.oneOfGetter($oneOfFields = ["id"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Food.prototype, "_x", {
            get: $util.oneOfGetter($oneOfFields = ["x"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Food.prototype, "_y", {
            get: $util.oneOfGetter($oneOfFields = ["y"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Food.prototype, "_value", {
            get: $util.oneOfGetter($oneOfFields = ["value"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Food.prototype, "_color", {
            get: $util.oneOfGetter($oneOfFields = ["color"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Food.prototype, "_image", {
            get: $util.oneOfGetter($oneOfFields = ["image"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new Food instance using the specified properties.
         * @function create
         * @memberof snake.Food
         * @static
         * @param {snake.IFood=} [properties] Properties to set
         * @returns {snake.Food} Food instance
         */
        Food.create = function create(properties) {
            return new Food(properties);
        };

        /**
         * Encodes the specified Food message. Does not implicitly {@link snake.Food.verify|verify} messages.
         * @function encode
         * @memberof snake.Food
         * @static
         * @param {snake.IFood} message Food message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Food.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.y);
            if (message.value != null && Object.hasOwnProperty.call(message, "value"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.value);
            if (message.color != null && Object.hasOwnProperty.call(message, "color"))
                writer.uint32(/* id 5, wireType 2 =*/42).string(message.color);
            if (message.image != null && Object.hasOwnProperty.call(message, "image"))
                writer.uint32(/* id 6, wireType 2 =*/50).string(message.image);
            return writer;
        };

        /**
         * Encodes the specified Food message, length delimited. Does not implicitly {@link snake.Food.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.Food
         * @static
         * @param {snake.IFood} message Food message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Food.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a Food message from the specified reader or buffer.
         * @function decode
         * @memberof snake.Food
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.Food} Food
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Food.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.Food();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.int32();
                        break;
                    }
                case 2: {
                        message.x = reader.float();
                        break;
                    }
                case 3: {
                        message.y = reader.float();
                        break;
                    }
                case 4: {
                        message.value = reader.int32();
                        break;
                    }
                case 5: {
                        message.color = reader.string();
                        break;
                    }
                case 6: {
                        message.image = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Food message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.Food
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.Food} Food
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Food.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Food message.
         * @function verify
         * @memberof snake.Food
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Food.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                properties._id = 1;
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            }
            if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                properties._x = 1;
                if (typeof message.x !== "number")
                    return "x: number expected";
            }
            if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                properties._y = 1;
                if (typeof message.y !== "number")
                    return "y: number expected";
            }
            if (message.value != null && Object.hasOwnProperty.call(message, "value")) {
                properties._value = 1;
                if (!$util.isInteger(message.value))
                    return "value: integer expected";
            }
            if (message.color != null && Object.hasOwnProperty.call(message, "color")) {
                properties._color = 1;
                if (!$util.isString(message.color))
                    return "color: string expected";
            }
            if (message.image != null && Object.hasOwnProperty.call(message, "image")) {
                properties._image = 1;
                if (!$util.isString(message.image))
                    return "image: string expected";
            }
            return null;
        };

        /**
         * Creates a Food message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.Food
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.Food} Food
         */
        Food.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.Food)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.Food: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.Food();
            if (object.id != null)
                message.id = object.id | 0;
            if (object.x != null)
                message.x = Number(object.x);
            if (object.y != null)
                message.y = Number(object.y);
            if (object.value != null)
                message.value = object.value | 0;
            if (object.color != null)
                message.color = String(object.color);
            if (object.image != null)
                message.image = String(object.image);
            return message;
        };

        /**
         * Creates a plain object from a Food message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.Food
         * @static
         * @param {snake.Food} message Food
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Food.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                object.id = message.id;
                if (options.oneofs)
                    object._id = "id";
            }
            if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                object.x = options.json && !isFinite(message.x) ? String(message.x) : message.x;
                if (options.oneofs)
                    object._x = "x";
            }
            if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                object.y = options.json && !isFinite(message.y) ? String(message.y) : message.y;
                if (options.oneofs)
                    object._y = "y";
            }
            if (message.value != null && Object.hasOwnProperty.call(message, "value")) {
                object.value = message.value;
                if (options.oneofs)
                    object._value = "value";
            }
            if (message.color != null && Object.hasOwnProperty.call(message, "color")) {
                object.color = message.color;
                if (options.oneofs)
                    object._color = "color";
            }
            if (message.image != null && Object.hasOwnProperty.call(message, "image")) {
                object.image = message.image;
                if (options.oneofs)
                    object._image = "image";
            }
            return object;
        };

        /**
         * Converts this Food to JSON.
         * @function toJSON
         * @memberof snake.Food
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Food.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Food
         * @function getTypeUrl
         * @memberof snake.Food
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Food.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.Food";
        };

        return Food;
    })();

    snake.MovedFood = (function() {

        /**
         * Properties of a MovedFood.
         * @memberof snake
         * @interface IMovedFood
         * @property {number|null} [id] MovedFood id
         * @property {number|null} [x] MovedFood x
         * @property {number|null} [y] MovedFood y
         */

        /**
         * Constructs a new MovedFood.
         * @memberof snake
         * @classdesc Represents a MovedFood.
         * @implements IMovedFood
         * @constructor
         * @param {snake.IMovedFood=} [properties] Properties to set
         */
        function MovedFood(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * MovedFood id.
         * @member {number|null|undefined} id
         * @memberof snake.MovedFood
         * @instance
         */
        MovedFood.prototype.id = null;

        /**
         * MovedFood x.
         * @member {number|null|undefined} x
         * @memberof snake.MovedFood
         * @instance
         */
        MovedFood.prototype.x = null;

        /**
         * MovedFood y.
         * @member {number|null|undefined} y
         * @memberof snake.MovedFood
         * @instance
         */
        MovedFood.prototype.y = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(MovedFood.prototype, "_id", {
            get: $util.oneOfGetter($oneOfFields = ["id"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(MovedFood.prototype, "_x", {
            get: $util.oneOfGetter($oneOfFields = ["x"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(MovedFood.prototype, "_y", {
            get: $util.oneOfGetter($oneOfFields = ["y"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new MovedFood instance using the specified properties.
         * @function create
         * @memberof snake.MovedFood
         * @static
         * @param {snake.IMovedFood=} [properties] Properties to set
         * @returns {snake.MovedFood} MovedFood instance
         */
        MovedFood.create = function create(properties) {
            return new MovedFood(properties);
        };

        /**
         * Encodes the specified MovedFood message. Does not implicitly {@link snake.MovedFood.verify|verify} messages.
         * @function encode
         * @memberof snake.MovedFood
         * @static
         * @param {snake.IMovedFood} message MovedFood message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MovedFood.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.id);
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.y);
            return writer;
        };

        /**
         * Encodes the specified MovedFood message, length delimited. Does not implicitly {@link snake.MovedFood.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.MovedFood
         * @static
         * @param {snake.IMovedFood} message MovedFood message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        MovedFood.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a MovedFood message from the specified reader or buffer.
         * @function decode
         * @memberof snake.MovedFood
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.MovedFood} MovedFood
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MovedFood.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.MovedFood();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.int32();
                        break;
                    }
                case 2: {
                        message.x = reader.float();
                        break;
                    }
                case 3: {
                        message.y = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a MovedFood message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.MovedFood
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.MovedFood} MovedFood
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        MovedFood.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a MovedFood message.
         * @function verify
         * @memberof snake.MovedFood
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        MovedFood.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                properties._id = 1;
                if (!$util.isInteger(message.id))
                    return "id: integer expected";
            }
            if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                properties._x = 1;
                if (typeof message.x !== "number")
                    return "x: number expected";
            }
            if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                properties._y = 1;
                if (typeof message.y !== "number")
                    return "y: number expected";
            }
            return null;
        };

        /**
         * Creates a MovedFood message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.MovedFood
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.MovedFood} MovedFood
         */
        MovedFood.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.MovedFood)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.MovedFood: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.MovedFood();
            if (object.id != null)
                message.id = object.id | 0;
            if (object.x != null)
                message.x = Number(object.x);
            if (object.y != null)
                message.y = Number(object.y);
            return message;
        };

        /**
         * Creates a plain object from a MovedFood message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.MovedFood
         * @static
         * @param {snake.MovedFood} message MovedFood
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        MovedFood.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                object.id = message.id;
                if (options.oneofs)
                    object._id = "id";
            }
            if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                object.x = options.json && !isFinite(message.x) ? String(message.x) : message.x;
                if (options.oneofs)
                    object._x = "x";
            }
            if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                object.y = options.json && !isFinite(message.y) ? String(message.y) : message.y;
                if (options.oneofs)
                    object._y = "y";
            }
            return object;
        };

        /**
         * Converts this MovedFood to JSON.
         * @function toJSON
         * @memberof snake.MovedFood
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        MovedFood.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for MovedFood
         * @function getTypeUrl
         * @memberof snake.MovedFood
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        MovedFood.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.MovedFood";
        };

        return MovedFood;
    })();

    snake.Portal = (function() {

        /**
         * Properties of a Portal.
         * @memberof snake
         * @interface IPortal
         * @property {string|null} [id] Portal id
         * @property {string|null} [color] Portal color
         * @property {number|null} [x1] Portal x1
         * @property {number|null} [y1] Portal y1
         * @property {number|null} [x2] Portal x2
         * @property {number|null} [y2] Portal y2
         * @property {number|null} [radius] Portal radius
         * @property {number|null} [current_scale] Portal current_scale
         */

        /**
         * Constructs a new Portal.
         * @memberof snake
         * @classdesc Represents a Portal.
         * @implements IPortal
         * @constructor
         * @param {snake.IPortal=} [properties] Properties to set
         */
        function Portal(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Portal id.
         * @member {string|null|undefined} id
         * @memberof snake.Portal
         * @instance
         */
        Portal.prototype.id = null;

        /**
         * Portal color.
         * @member {string|null|undefined} color
         * @memberof snake.Portal
         * @instance
         */
        Portal.prototype.color = null;

        /**
         * Portal x1.
         * @member {number|null|undefined} x1
         * @memberof snake.Portal
         * @instance
         */
        Portal.prototype.x1 = null;

        /**
         * Portal y1.
         * @member {number|null|undefined} y1
         * @memberof snake.Portal
         * @instance
         */
        Portal.prototype.y1 = null;

        /**
         * Portal x2.
         * @member {number|null|undefined} x2
         * @memberof snake.Portal
         * @instance
         */
        Portal.prototype.x2 = null;

        /**
         * Portal y2.
         * @member {number|null|undefined} y2
         * @memberof snake.Portal
         * @instance
         */
        Portal.prototype.y2 = null;

        /**
         * Portal radius.
         * @member {number|null|undefined} radius
         * @memberof snake.Portal
         * @instance
         */
        Portal.prototype.radius = null;

        /**
         * Portal current_scale.
         * @member {number|null|undefined} current_scale
         * @memberof snake.Portal
         * @instance
         */
        Portal.prototype.current_scale = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Portal.prototype, "_id", {
            get: $util.oneOfGetter($oneOfFields = ["id"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Portal.prototype, "_color", {
            get: $util.oneOfGetter($oneOfFields = ["color"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Portal.prototype, "_x1", {
            get: $util.oneOfGetter($oneOfFields = ["x1"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Portal.prototype, "_y1", {
            get: $util.oneOfGetter($oneOfFields = ["y1"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Portal.prototype, "_x2", {
            get: $util.oneOfGetter($oneOfFields = ["x2"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Portal.prototype, "_y2", {
            get: $util.oneOfGetter($oneOfFields = ["y2"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Portal.prototype, "_radius", {
            get: $util.oneOfGetter($oneOfFields = ["radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Portal.prototype, "_current_scale", {
            get: $util.oneOfGetter($oneOfFields = ["current_scale"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new Portal instance using the specified properties.
         * @function create
         * @memberof snake.Portal
         * @static
         * @param {snake.IPortal=} [properties] Properties to set
         * @returns {snake.Portal} Portal instance
         */
        Portal.create = function create(properties) {
            return new Portal(properties);
        };

        /**
         * Encodes the specified Portal message. Does not implicitly {@link snake.Portal.verify|verify} messages.
         * @function encode
         * @memberof snake.Portal
         * @static
         * @param {snake.IPortal} message Portal message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Portal.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.color != null && Object.hasOwnProperty.call(message, "color"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.color);
            if (message.x1 != null && Object.hasOwnProperty.call(message, "x1"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.x1);
            if (message.y1 != null && Object.hasOwnProperty.call(message, "y1"))
                writer.uint32(/* id 4, wireType 5 =*/37).float(message.y1);
            if (message.x2 != null && Object.hasOwnProperty.call(message, "x2"))
                writer.uint32(/* id 5, wireType 5 =*/45).float(message.x2);
            if (message.y2 != null && Object.hasOwnProperty.call(message, "y2"))
                writer.uint32(/* id 6, wireType 5 =*/53).float(message.y2);
            if (message.radius != null && Object.hasOwnProperty.call(message, "radius"))
                writer.uint32(/* id 7, wireType 5 =*/61).float(message.radius);
            if (message.current_scale != null && Object.hasOwnProperty.call(message, "current_scale"))
                writer.uint32(/* id 8, wireType 5 =*/69).float(message.current_scale);
            return writer;
        };

        /**
         * Encodes the specified Portal message, length delimited. Does not implicitly {@link snake.Portal.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.Portal
         * @static
         * @param {snake.IPortal} message Portal message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Portal.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a Portal message from the specified reader or buffer.
         * @function decode
         * @memberof snake.Portal
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.Portal} Portal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Portal.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.Portal();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.string();
                        break;
                    }
                case 2: {
                        message.color = reader.string();
                        break;
                    }
                case 3: {
                        message.x1 = reader.float();
                        break;
                    }
                case 4: {
                        message.y1 = reader.float();
                        break;
                    }
                case 5: {
                        message.x2 = reader.float();
                        break;
                    }
                case 6: {
                        message.y2 = reader.float();
                        break;
                    }
                case 7: {
                        message.radius = reader.float();
                        break;
                    }
                case 8: {
                        message.current_scale = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Portal message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.Portal
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.Portal} Portal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Portal.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Portal message.
         * @function verify
         * @memberof snake.Portal
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Portal.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                properties._id = 1;
                if (!$util.isString(message.id))
                    return "id: string expected";
            }
            if (message.color != null && Object.hasOwnProperty.call(message, "color")) {
                properties._color = 1;
                if (!$util.isString(message.color))
                    return "color: string expected";
            }
            if (message.x1 != null && Object.hasOwnProperty.call(message, "x1")) {
                properties._x1 = 1;
                if (typeof message.x1 !== "number")
                    return "x1: number expected";
            }
            if (message.y1 != null && Object.hasOwnProperty.call(message, "y1")) {
                properties._y1 = 1;
                if (typeof message.y1 !== "number")
                    return "y1: number expected";
            }
            if (message.x2 != null && Object.hasOwnProperty.call(message, "x2")) {
                properties._x2 = 1;
                if (typeof message.x2 !== "number")
                    return "x2: number expected";
            }
            if (message.y2 != null && Object.hasOwnProperty.call(message, "y2")) {
                properties._y2 = 1;
                if (typeof message.y2 !== "number")
                    return "y2: number expected";
            }
            if (message.radius != null && Object.hasOwnProperty.call(message, "radius")) {
                properties._radius = 1;
                if (typeof message.radius !== "number")
                    return "radius: number expected";
            }
            if (message.current_scale != null && Object.hasOwnProperty.call(message, "current_scale")) {
                properties._current_scale = 1;
                if (typeof message.current_scale !== "number")
                    return "current_scale: number expected";
            }
            return null;
        };

        /**
         * Creates a Portal message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.Portal
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.Portal} Portal
         */
        Portal.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.Portal)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.Portal: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.Portal();
            if (object.id != null)
                message.id = String(object.id);
            if (object.color != null)
                message.color = String(object.color);
            if (object.x1 != null)
                message.x1 = Number(object.x1);
            if (object.y1 != null)
                message.y1 = Number(object.y1);
            if (object.x2 != null)
                message.x2 = Number(object.x2);
            if (object.y2 != null)
                message.y2 = Number(object.y2);
            if (object.radius != null)
                message.radius = Number(object.radius);
            if (object.current_scale != null)
                message.current_scale = Number(object.current_scale);
            return message;
        };

        /**
         * Creates a plain object from a Portal message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.Portal
         * @static
         * @param {snake.Portal} message Portal
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Portal.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                object.id = message.id;
                if (options.oneofs)
                    object._id = "id";
            }
            if (message.color != null && Object.hasOwnProperty.call(message, "color")) {
                object.color = message.color;
                if (options.oneofs)
                    object._color = "color";
            }
            if (message.x1 != null && Object.hasOwnProperty.call(message, "x1")) {
                object.x1 = options.json && !isFinite(message.x1) ? String(message.x1) : message.x1;
                if (options.oneofs)
                    object._x1 = "x1";
            }
            if (message.y1 != null && Object.hasOwnProperty.call(message, "y1")) {
                object.y1 = options.json && !isFinite(message.y1) ? String(message.y1) : message.y1;
                if (options.oneofs)
                    object._y1 = "y1";
            }
            if (message.x2 != null && Object.hasOwnProperty.call(message, "x2")) {
                object.x2 = options.json && !isFinite(message.x2) ? String(message.x2) : message.x2;
                if (options.oneofs)
                    object._x2 = "x2";
            }
            if (message.y2 != null && Object.hasOwnProperty.call(message, "y2")) {
                object.y2 = options.json && !isFinite(message.y2) ? String(message.y2) : message.y2;
                if (options.oneofs)
                    object._y2 = "y2";
            }
            if (message.radius != null && Object.hasOwnProperty.call(message, "radius")) {
                object.radius = options.json && !isFinite(message.radius) ? String(message.radius) : message.radius;
                if (options.oneofs)
                    object._radius = "radius";
            }
            if (message.current_scale != null && Object.hasOwnProperty.call(message, "current_scale")) {
                object.current_scale = options.json && !isFinite(message.current_scale) ? String(message.current_scale) : message.current_scale;
                if (options.oneofs)
                    object._current_scale = "current_scale";
            }
            return object;
        };

        /**
         * Converts this Portal to JSON.
         * @function toJSON
         * @memberof snake.Portal
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Portal.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Portal
         * @function getTypeUrl
         * @memberof snake.Portal
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Portal.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.Portal";
        };

        return Portal;
    })();

    snake.BlackHole = (function() {

        /**
         * Properties of a BlackHole.
         * @memberof snake
         * @interface IBlackHole
         * @property {string|null} [id] BlackHole id
         * @property {number|null} [x] BlackHole x
         * @property {number|null} [y] BlackHole y
         * @property {number|null} [pull_radius] BlackHole pull_radius
         * @property {number|null} [kill_radius] BlackHole kill_radius
         */

        /**
         * Constructs a new BlackHole.
         * @memberof snake
         * @classdesc Represents a BlackHole.
         * @implements IBlackHole
         * @constructor
         * @param {snake.IBlackHole=} [properties] Properties to set
         */
        function BlackHole(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * BlackHole id.
         * @member {string|null|undefined} id
         * @memberof snake.BlackHole
         * @instance
         */
        BlackHole.prototype.id = null;

        /**
         * BlackHole x.
         * @member {number|null|undefined} x
         * @memberof snake.BlackHole
         * @instance
         */
        BlackHole.prototype.x = null;

        /**
         * BlackHole y.
         * @member {number|null|undefined} y
         * @memberof snake.BlackHole
         * @instance
         */
        BlackHole.prototype.y = null;

        /**
         * BlackHole pull_radius.
         * @member {number|null|undefined} pull_radius
         * @memberof snake.BlackHole
         * @instance
         */
        BlackHole.prototype.pull_radius = null;

        /**
         * BlackHole kill_radius.
         * @member {number|null|undefined} kill_radius
         * @memberof snake.BlackHole
         * @instance
         */
        BlackHole.prototype.kill_radius = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(BlackHole.prototype, "_id", {
            get: $util.oneOfGetter($oneOfFields = ["id"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(BlackHole.prototype, "_x", {
            get: $util.oneOfGetter($oneOfFields = ["x"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(BlackHole.prototype, "_y", {
            get: $util.oneOfGetter($oneOfFields = ["y"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(BlackHole.prototype, "_pull_radius", {
            get: $util.oneOfGetter($oneOfFields = ["pull_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(BlackHole.prototype, "_kill_radius", {
            get: $util.oneOfGetter($oneOfFields = ["kill_radius"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new BlackHole instance using the specified properties.
         * @function create
         * @memberof snake.BlackHole
         * @static
         * @param {snake.IBlackHole=} [properties] Properties to set
         * @returns {snake.BlackHole} BlackHole instance
         */
        BlackHole.create = function create(properties) {
            return new BlackHole(properties);
        };

        /**
         * Encodes the specified BlackHole message. Does not implicitly {@link snake.BlackHole.verify|verify} messages.
         * @function encode
         * @memberof snake.BlackHole
         * @static
         * @param {snake.IBlackHole} message BlackHole message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        BlackHole.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.y);
            if (message.pull_radius != null && Object.hasOwnProperty.call(message, "pull_radius"))
                writer.uint32(/* id 4, wireType 5 =*/37).float(message.pull_radius);
            if (message.kill_radius != null && Object.hasOwnProperty.call(message, "kill_radius"))
                writer.uint32(/* id 5, wireType 5 =*/45).float(message.kill_radius);
            return writer;
        };

        /**
         * Encodes the specified BlackHole message, length delimited. Does not implicitly {@link snake.BlackHole.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.BlackHole
         * @static
         * @param {snake.IBlackHole} message BlackHole message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        BlackHole.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a BlackHole message from the specified reader or buffer.
         * @function decode
         * @memberof snake.BlackHole
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.BlackHole} BlackHole
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        BlackHole.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.BlackHole();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.string();
                        break;
                    }
                case 2: {
                        message.x = reader.float();
                        break;
                    }
                case 3: {
                        message.y = reader.float();
                        break;
                    }
                case 4: {
                        message.pull_radius = reader.float();
                        break;
                    }
                case 5: {
                        message.kill_radius = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a BlackHole message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.BlackHole
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.BlackHole} BlackHole
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        BlackHole.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a BlackHole message.
         * @function verify
         * @memberof snake.BlackHole
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        BlackHole.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                properties._id = 1;
                if (!$util.isString(message.id))
                    return "id: string expected";
            }
            if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                properties._x = 1;
                if (typeof message.x !== "number")
                    return "x: number expected";
            }
            if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                properties._y = 1;
                if (typeof message.y !== "number")
                    return "y: number expected";
            }
            if (message.pull_radius != null && Object.hasOwnProperty.call(message, "pull_radius")) {
                properties._pull_radius = 1;
                if (typeof message.pull_radius !== "number")
                    return "pull_radius: number expected";
            }
            if (message.kill_radius != null && Object.hasOwnProperty.call(message, "kill_radius")) {
                properties._kill_radius = 1;
                if (typeof message.kill_radius !== "number")
                    return "kill_radius: number expected";
            }
            return null;
        };

        /**
         * Creates a BlackHole message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.BlackHole
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.BlackHole} BlackHole
         */
        BlackHole.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.BlackHole)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.BlackHole: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.BlackHole();
            if (object.id != null)
                message.id = String(object.id);
            if (object.x != null)
                message.x = Number(object.x);
            if (object.y != null)
                message.y = Number(object.y);
            if (object.pull_radius != null)
                message.pull_radius = Number(object.pull_radius);
            if (object.kill_radius != null)
                message.kill_radius = Number(object.kill_radius);
            return message;
        };

        /**
         * Creates a plain object from a BlackHole message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.BlackHole
         * @static
         * @param {snake.BlackHole} message BlackHole
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        BlackHole.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                object.id = message.id;
                if (options.oneofs)
                    object._id = "id";
            }
            if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                object.x = options.json && !isFinite(message.x) ? String(message.x) : message.x;
                if (options.oneofs)
                    object._x = "x";
            }
            if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                object.y = options.json && !isFinite(message.y) ? String(message.y) : message.y;
                if (options.oneofs)
                    object._y = "y";
            }
            if (message.pull_radius != null && Object.hasOwnProperty.call(message, "pull_radius")) {
                object.pull_radius = options.json && !isFinite(message.pull_radius) ? String(message.pull_radius) : message.pull_radius;
                if (options.oneofs)
                    object._pull_radius = "pull_radius";
            }
            if (message.kill_radius != null && Object.hasOwnProperty.call(message, "kill_radius")) {
                object.kill_radius = options.json && !isFinite(message.kill_radius) ? String(message.kill_radius) : message.kill_radius;
                if (options.oneofs)
                    object._kill_radius = "kill_radius";
            }
            return object;
        };

        /**
         * Converts this BlackHole to JSON.
         * @function toJSON
         * @memberof snake.BlackHole
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        BlackHole.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for BlackHole
         * @function getTypeUrl
         * @memberof snake.BlackHole
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        BlackHole.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.BlackHole";
        };

        return BlackHole;
    })();

    snake.Tombstone = (function() {

        /**
         * Properties of a Tombstone.
         * @memberof snake
         * @interface ITombstone
         * @property {string|null} [id] Tombstone id
         * @property {number|null} [x] Tombstone x
         * @property {number|null} [y] Tombstone y
         * @property {string|null} [nickname] Tombstone nickname
         * @property {number|null} [time_left] Tombstone time_left
         */

        /**
         * Constructs a new Tombstone.
         * @memberof snake
         * @classdesc Represents a Tombstone.
         * @implements ITombstone
         * @constructor
         * @param {snake.ITombstone=} [properties] Properties to set
         */
        function Tombstone(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Tombstone id.
         * @member {string|null|undefined} id
         * @memberof snake.Tombstone
         * @instance
         */
        Tombstone.prototype.id = null;

        /**
         * Tombstone x.
         * @member {number|null|undefined} x
         * @memberof snake.Tombstone
         * @instance
         */
        Tombstone.prototype.x = null;

        /**
         * Tombstone y.
         * @member {number|null|undefined} y
         * @memberof snake.Tombstone
         * @instance
         */
        Tombstone.prototype.y = null;

        /**
         * Tombstone nickname.
         * @member {string|null|undefined} nickname
         * @memberof snake.Tombstone
         * @instance
         */
        Tombstone.prototype.nickname = null;

        /**
         * Tombstone time_left.
         * @member {number|null|undefined} time_left
         * @memberof snake.Tombstone
         * @instance
         */
        Tombstone.prototype.time_left = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Tombstone.prototype, "_id", {
            get: $util.oneOfGetter($oneOfFields = ["id"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Tombstone.prototype, "_x", {
            get: $util.oneOfGetter($oneOfFields = ["x"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Tombstone.prototype, "_y", {
            get: $util.oneOfGetter($oneOfFields = ["y"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Tombstone.prototype, "_nickname", {
            get: $util.oneOfGetter($oneOfFields = ["nickname"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Tombstone.prototype, "_time_left", {
            get: $util.oneOfGetter($oneOfFields = ["time_left"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new Tombstone instance using the specified properties.
         * @function create
         * @memberof snake.Tombstone
         * @static
         * @param {snake.ITombstone=} [properties] Properties to set
         * @returns {snake.Tombstone} Tombstone instance
         */
        Tombstone.create = function create(properties) {
            return new Tombstone(properties);
        };

        /**
         * Encodes the specified Tombstone message. Does not implicitly {@link snake.Tombstone.verify|verify} messages.
         * @function encode
         * @memberof snake.Tombstone
         * @static
         * @param {snake.ITombstone} message Tombstone message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Tombstone.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.id != null && Object.hasOwnProperty.call(message, "id"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.id);
            if (message.x != null && Object.hasOwnProperty.call(message, "x"))
                writer.uint32(/* id 2, wireType 5 =*/21).float(message.x);
            if (message.y != null && Object.hasOwnProperty.call(message, "y"))
                writer.uint32(/* id 3, wireType 5 =*/29).float(message.y);
            if (message.nickname != null && Object.hasOwnProperty.call(message, "nickname"))
                writer.uint32(/* id 4, wireType 2 =*/34).string(message.nickname);
            if (message.time_left != null && Object.hasOwnProperty.call(message, "time_left"))
                writer.uint32(/* id 5, wireType 5 =*/45).float(message.time_left);
            return writer;
        };

        /**
         * Encodes the specified Tombstone message, length delimited. Does not implicitly {@link snake.Tombstone.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.Tombstone
         * @static
         * @param {snake.ITombstone} message Tombstone message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Tombstone.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a Tombstone message from the specified reader or buffer.
         * @function decode
         * @memberof snake.Tombstone
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.Tombstone} Tombstone
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Tombstone.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.Tombstone();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.id = reader.string();
                        break;
                    }
                case 2: {
                        message.x = reader.float();
                        break;
                    }
                case 3: {
                        message.y = reader.float();
                        break;
                    }
                case 4: {
                        message.nickname = reader.string();
                        break;
                    }
                case 5: {
                        message.time_left = reader.float();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Tombstone message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.Tombstone
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.Tombstone} Tombstone
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Tombstone.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Tombstone message.
         * @function verify
         * @memberof snake.Tombstone
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Tombstone.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                properties._id = 1;
                if (!$util.isString(message.id))
                    return "id: string expected";
            }
            if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                properties._x = 1;
                if (typeof message.x !== "number")
                    return "x: number expected";
            }
            if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                properties._y = 1;
                if (typeof message.y !== "number")
                    return "y: number expected";
            }
            if (message.nickname != null && Object.hasOwnProperty.call(message, "nickname")) {
                properties._nickname = 1;
                if (!$util.isString(message.nickname))
                    return "nickname: string expected";
            }
            if (message.time_left != null && Object.hasOwnProperty.call(message, "time_left")) {
                properties._time_left = 1;
                if (typeof message.time_left !== "number")
                    return "time_left: number expected";
            }
            return null;
        };

        /**
         * Creates a Tombstone message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.Tombstone
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.Tombstone} Tombstone
         */
        Tombstone.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.Tombstone)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.Tombstone: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.Tombstone();
            if (object.id != null)
                message.id = String(object.id);
            if (object.x != null)
                message.x = Number(object.x);
            if (object.y != null)
                message.y = Number(object.y);
            if (object.nickname != null)
                message.nickname = String(object.nickname);
            if (object.time_left != null)
                message.time_left = Number(object.time_left);
            return message;
        };

        /**
         * Creates a plain object from a Tombstone message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.Tombstone
         * @static
         * @param {snake.Tombstone} message Tombstone
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Tombstone.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.id != null && Object.hasOwnProperty.call(message, "id")) {
                object.id = message.id;
                if (options.oneofs)
                    object._id = "id";
            }
            if (message.x != null && Object.hasOwnProperty.call(message, "x")) {
                object.x = options.json && !isFinite(message.x) ? String(message.x) : message.x;
                if (options.oneofs)
                    object._x = "x";
            }
            if (message.y != null && Object.hasOwnProperty.call(message, "y")) {
                object.y = options.json && !isFinite(message.y) ? String(message.y) : message.y;
                if (options.oneofs)
                    object._y = "y";
            }
            if (message.nickname != null && Object.hasOwnProperty.call(message, "nickname")) {
                object.nickname = message.nickname;
                if (options.oneofs)
                    object._nickname = "nickname";
            }
            if (message.time_left != null && Object.hasOwnProperty.call(message, "time_left")) {
                object.time_left = options.json && !isFinite(message.time_left) ? String(message.time_left) : message.time_left;
                if (options.oneofs)
                    object._time_left = "time_left";
            }
            return object;
        };

        /**
         * Converts this Tombstone to JSON.
         * @function toJSON
         * @memberof snake.Tombstone
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Tombstone.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Tombstone
         * @function getTypeUrl
         * @memberof snake.Tombstone
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Tombstone.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.Tombstone";
        };

        return Tombstone;
    })();

    snake.KillEvent = (function() {

        /**
         * Properties of a KillEvent.
         * @memberof snake
         * @interface IKillEvent
         * @property {string|null} [killer] KillEvent killer
         * @property {string|null} [victim] KillEvent victim
         */

        /**
         * Constructs a new KillEvent.
         * @memberof snake
         * @classdesc Represents a KillEvent.
         * @implements IKillEvent
         * @constructor
         * @param {snake.IKillEvent=} [properties] Properties to set
         */
        function KillEvent(properties) {
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * KillEvent killer.
         * @member {string|null|undefined} killer
         * @memberof snake.KillEvent
         * @instance
         */
        KillEvent.prototype.killer = null;

        /**
         * KillEvent victim.
         * @member {string|null|undefined} victim
         * @memberof snake.KillEvent
         * @instance
         */
        KillEvent.prototype.victim = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(KillEvent.prototype, "_killer", {
            get: $util.oneOfGetter($oneOfFields = ["killer"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(KillEvent.prototype, "_victim", {
            get: $util.oneOfGetter($oneOfFields = ["victim"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new KillEvent instance using the specified properties.
         * @function create
         * @memberof snake.KillEvent
         * @static
         * @param {snake.IKillEvent=} [properties] Properties to set
         * @returns {snake.KillEvent} KillEvent instance
         */
        KillEvent.create = function create(properties) {
            return new KillEvent(properties);
        };

        /**
         * Encodes the specified KillEvent message. Does not implicitly {@link snake.KillEvent.verify|verify} messages.
         * @function encode
         * @memberof snake.KillEvent
         * @static
         * @param {snake.IKillEvent} message KillEvent message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        KillEvent.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.killer != null && Object.hasOwnProperty.call(message, "killer"))
                writer.uint32(/* id 1, wireType 2 =*/10).string(message.killer);
            if (message.victim != null && Object.hasOwnProperty.call(message, "victim"))
                writer.uint32(/* id 2, wireType 2 =*/18).string(message.victim);
            return writer;
        };

        /**
         * Encodes the specified KillEvent message, length delimited. Does not implicitly {@link snake.KillEvent.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.KillEvent
         * @static
         * @param {snake.IKillEvent} message KillEvent message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        KillEvent.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a KillEvent message from the specified reader or buffer.
         * @function decode
         * @memberof snake.KillEvent
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.KillEvent} KillEvent
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        KillEvent.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.KillEvent();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.killer = reader.string();
                        break;
                    }
                case 2: {
                        message.victim = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a KillEvent message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.KillEvent
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.KillEvent} KillEvent
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        KillEvent.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a KillEvent message.
         * @function verify
         * @memberof snake.KillEvent
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        KillEvent.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.killer != null && Object.hasOwnProperty.call(message, "killer")) {
                properties._killer = 1;
                if (!$util.isString(message.killer))
                    return "killer: string expected";
            }
            if (message.victim != null && Object.hasOwnProperty.call(message, "victim")) {
                properties._victim = 1;
                if (!$util.isString(message.victim))
                    return "victim: string expected";
            }
            return null;
        };

        /**
         * Creates a KillEvent message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.KillEvent
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.KillEvent} KillEvent
         */
        KillEvent.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.KillEvent)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.KillEvent: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.KillEvent();
            if (object.killer != null)
                message.killer = String(object.killer);
            if (object.victim != null)
                message.victim = String(object.victim);
            return message;
        };

        /**
         * Creates a plain object from a KillEvent message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.KillEvent
         * @static
         * @param {snake.KillEvent} message KillEvent
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        KillEvent.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (message.killer != null && Object.hasOwnProperty.call(message, "killer")) {
                object.killer = message.killer;
                if (options.oneofs)
                    object._killer = "killer";
            }
            if (message.victim != null && Object.hasOwnProperty.call(message, "victim")) {
                object.victim = message.victim;
                if (options.oneofs)
                    object._victim = "victim";
            }
            return object;
        };

        /**
         * Converts this KillEvent to JSON.
         * @function toJSON
         * @memberof snake.KillEvent
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        KillEvent.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for KillEvent
         * @function getTypeUrl
         * @memberof snake.KillEvent
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        KillEvent.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.KillEvent";
        };

        return KillEvent;
    })();

    snake.Player = (function() {

        /**
         * Properties of a Player.
         * @memberof snake
         * @interface IPlayer
         * @property {number|null} [angle] Player angle
         * @property {number|null} [score] Player score
         * @property {number|null} [kills] Player kills
         * @property {number|null} [deaths] Player deaths
         * @property {boolean|null} [accelerating] Player accelerating
         * @property {boolean|null} [is_dead] Player is_dead
         * @property {string|null} [teleport_state] Player teleport_state
         * @property {number|null} [teleport_out_x] Player teleport_out_x
         * @property {number|null} [teleport_out_y] Player teleport_out_y
         * @property {number|null} [teleport_timer_ratio] Player teleport_timer_ratio
         * @property {string|null} [skin] Player skin
         * @property {string|null} [nickname] Player nickname
         * @property {Array.<number>|null} [body] Player body
         * @property {Array.<number>|null} [new_heads] Player new_heads
         * @property {number|null} [length] Player length
         */

        /**
         * Constructs a new Player.
         * @memberof snake
         * @classdesc Represents a Player.
         * @implements IPlayer
         * @constructor
         * @param {snake.IPlayer=} [properties] Properties to set
         */
        function Player(properties) {
            this.body = [];
            this.new_heads = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * Player angle.
         * @member {number|null|undefined} angle
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.angle = null;

        /**
         * Player score.
         * @member {number|null|undefined} score
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.score = null;

        /**
         * Player kills.
         * @member {number|null|undefined} kills
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.kills = null;

        /**
         * Player deaths.
         * @member {number|null|undefined} deaths
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.deaths = null;

        /**
         * Player accelerating.
         * @member {boolean|null|undefined} accelerating
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.accelerating = null;

        /**
         * Player is_dead.
         * @member {boolean|null|undefined} is_dead
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.is_dead = null;

        /**
         * Player teleport_state.
         * @member {string|null|undefined} teleport_state
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.teleport_state = null;

        /**
         * Player teleport_out_x.
         * @member {number|null|undefined} teleport_out_x
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.teleport_out_x = null;

        /**
         * Player teleport_out_y.
         * @member {number|null|undefined} teleport_out_y
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.teleport_out_y = null;

        /**
         * Player teleport_timer_ratio.
         * @member {number|null|undefined} teleport_timer_ratio
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.teleport_timer_ratio = null;

        /**
         * Player skin.
         * @member {string|null|undefined} skin
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.skin = null;

        /**
         * Player nickname.
         * @member {string|null|undefined} nickname
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.nickname = null;

        /**
         * Player body.
         * @member {Array.<number>} body
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.body = $util.emptyArray;

        /**
         * Player new_heads.
         * @member {Array.<number>} new_heads
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.new_heads = $util.emptyArray;

        /**
         * Player length.
         * @member {number|null|undefined} length
         * @memberof snake.Player
         * @instance
         */
        Player.prototype.length = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_angle", {
            get: $util.oneOfGetter($oneOfFields = ["angle"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_score", {
            get: $util.oneOfGetter($oneOfFields = ["score"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_kills", {
            get: $util.oneOfGetter($oneOfFields = ["kills"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_deaths", {
            get: $util.oneOfGetter($oneOfFields = ["deaths"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_accelerating", {
            get: $util.oneOfGetter($oneOfFields = ["accelerating"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_is_dead", {
            get: $util.oneOfGetter($oneOfFields = ["is_dead"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_teleport_state", {
            get: $util.oneOfGetter($oneOfFields = ["teleport_state"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_teleport_out_x", {
            get: $util.oneOfGetter($oneOfFields = ["teleport_out_x"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_teleport_out_y", {
            get: $util.oneOfGetter($oneOfFields = ["teleport_out_y"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_teleport_timer_ratio", {
            get: $util.oneOfGetter($oneOfFields = ["teleport_timer_ratio"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_skin", {
            get: $util.oneOfGetter($oneOfFields = ["skin"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_nickname", {
            get: $util.oneOfGetter($oneOfFields = ["nickname"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(Player.prototype, "_length", {
            get: $util.oneOfGetter($oneOfFields = ["length"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new Player instance using the specified properties.
         * @function create
         * @memberof snake.Player
         * @static
         * @param {snake.IPlayer=} [properties] Properties to set
         * @returns {snake.Player} Player instance
         */
        Player.create = function create(properties) {
            return new Player(properties);
        };

        /**
         * Encodes the specified Player message. Does not implicitly {@link snake.Player.verify|verify} messages.
         * @function encode
         * @memberof snake.Player
         * @static
         * @param {snake.IPlayer} message Player message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Player.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.angle != null && Object.hasOwnProperty.call(message, "angle"))
                writer.uint32(/* id 1, wireType 5 =*/13).float(message.angle);
            if (message.score != null && Object.hasOwnProperty.call(message, "score"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.score);
            if (message.kills != null && Object.hasOwnProperty.call(message, "kills"))
                writer.uint32(/* id 3, wireType 0 =*/24).int32(message.kills);
            if (message.deaths != null && Object.hasOwnProperty.call(message, "deaths"))
                writer.uint32(/* id 4, wireType 0 =*/32).int32(message.deaths);
            if (message.accelerating != null && Object.hasOwnProperty.call(message, "accelerating"))
                writer.uint32(/* id 5, wireType 0 =*/40).bool(message.accelerating);
            if (message.is_dead != null && Object.hasOwnProperty.call(message, "is_dead"))
                writer.uint32(/* id 6, wireType 0 =*/48).bool(message.is_dead);
            if (message.teleport_state != null && Object.hasOwnProperty.call(message, "teleport_state"))
                writer.uint32(/* id 7, wireType 2 =*/58).string(message.teleport_state);
            if (message.teleport_out_x != null && Object.hasOwnProperty.call(message, "teleport_out_x"))
                writer.uint32(/* id 8, wireType 5 =*/69).float(message.teleport_out_x);
            if (message.teleport_out_y != null && Object.hasOwnProperty.call(message, "teleport_out_y"))
                writer.uint32(/* id 9, wireType 5 =*/77).float(message.teleport_out_y);
            if (message.teleport_timer_ratio != null && Object.hasOwnProperty.call(message, "teleport_timer_ratio"))
                writer.uint32(/* id 10, wireType 5 =*/85).float(message.teleport_timer_ratio);
            if (message.skin != null && Object.hasOwnProperty.call(message, "skin"))
                writer.uint32(/* id 11, wireType 2 =*/90).string(message.skin);
            if (message.nickname != null && Object.hasOwnProperty.call(message, "nickname"))
                writer.uint32(/* id 12, wireType 2 =*/98).string(message.nickname);
            if (message.body != null && message.body.length) {
                writer.uint32(/* id 13, wireType 2 =*/106).fork();
                for (let i = 0; i < message.body.length; ++i)
                    writer.float(message.body[i]);
                writer.ldelim();
            }
            if (message.new_heads != null && message.new_heads.length) {
                writer.uint32(/* id 14, wireType 2 =*/114).fork();
                for (let i = 0; i < message.new_heads.length; ++i)
                    writer.float(message.new_heads[i]);
                writer.ldelim();
            }
            if (message.length != null && Object.hasOwnProperty.call(message, "length"))
                writer.uint32(/* id 15, wireType 0 =*/120).int32(message.length);
            return writer;
        };

        /**
         * Encodes the specified Player message, length delimited. Does not implicitly {@link snake.Player.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.Player
         * @static
         * @param {snake.IPlayer} message Player message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        Player.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a Player message from the specified reader or buffer.
         * @function decode
         * @memberof snake.Player
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.Player} Player
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Player.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.Player();
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.angle = reader.float();
                        break;
                    }
                case 2: {
                        message.score = reader.int32();
                        break;
                    }
                case 3: {
                        message.kills = reader.int32();
                        break;
                    }
                case 4: {
                        message.deaths = reader.int32();
                        break;
                    }
                case 5: {
                        message.accelerating = reader.bool();
                        break;
                    }
                case 6: {
                        message.is_dead = reader.bool();
                        break;
                    }
                case 7: {
                        message.teleport_state = reader.string();
                        break;
                    }
                case 8: {
                        message.teleport_out_x = reader.float();
                        break;
                    }
                case 9: {
                        message.teleport_out_y = reader.float();
                        break;
                    }
                case 10: {
                        message.teleport_timer_ratio = reader.float();
                        break;
                    }
                case 11: {
                        message.skin = reader.string();
                        break;
                    }
                case 12: {
                        message.nickname = reader.string();
                        break;
                    }
                case 13: {
                        if (!(message.body && message.body.length))
                            message.body = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.body.push(reader.float());
                        } else
                            message.body.push(reader.float());
                        break;
                    }
                case 14: {
                        if (!(message.new_heads && message.new_heads.length))
                            message.new_heads = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.new_heads.push(reader.float());
                        } else
                            message.new_heads.push(reader.float());
                        break;
                    }
                case 15: {
                        message.length = reader.int32();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a Player message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.Player
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.Player} Player
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        Player.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a Player message.
         * @function verify
         * @memberof snake.Player
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        Player.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.angle != null && Object.hasOwnProperty.call(message, "angle")) {
                properties._angle = 1;
                if (typeof message.angle !== "number")
                    return "angle: number expected";
            }
            if (message.score != null && Object.hasOwnProperty.call(message, "score")) {
                properties._score = 1;
                if (!$util.isInteger(message.score))
                    return "score: integer expected";
            }
            if (message.kills != null && Object.hasOwnProperty.call(message, "kills")) {
                properties._kills = 1;
                if (!$util.isInteger(message.kills))
                    return "kills: integer expected";
            }
            if (message.deaths != null && Object.hasOwnProperty.call(message, "deaths")) {
                properties._deaths = 1;
                if (!$util.isInteger(message.deaths))
                    return "deaths: integer expected";
            }
            if (message.accelerating != null && Object.hasOwnProperty.call(message, "accelerating")) {
                properties._accelerating = 1;
                if (typeof message.accelerating !== "boolean")
                    return "accelerating: boolean expected";
            }
            if (message.is_dead != null && Object.hasOwnProperty.call(message, "is_dead")) {
                properties._is_dead = 1;
                if (typeof message.is_dead !== "boolean")
                    return "is_dead: boolean expected";
            }
            if (message.teleport_state != null && Object.hasOwnProperty.call(message, "teleport_state")) {
                properties._teleport_state = 1;
                if (!$util.isString(message.teleport_state))
                    return "teleport_state: string expected";
            }
            if (message.teleport_out_x != null && Object.hasOwnProperty.call(message, "teleport_out_x")) {
                properties._teleport_out_x = 1;
                if (typeof message.teleport_out_x !== "number")
                    return "teleport_out_x: number expected";
            }
            if (message.teleport_out_y != null && Object.hasOwnProperty.call(message, "teleport_out_y")) {
                properties._teleport_out_y = 1;
                if (typeof message.teleport_out_y !== "number")
                    return "teleport_out_y: number expected";
            }
            if (message.teleport_timer_ratio != null && Object.hasOwnProperty.call(message, "teleport_timer_ratio")) {
                properties._teleport_timer_ratio = 1;
                if (typeof message.teleport_timer_ratio !== "number")
                    return "teleport_timer_ratio: number expected";
            }
            if (message.skin != null && Object.hasOwnProperty.call(message, "skin")) {
                properties._skin = 1;
                if (!$util.isString(message.skin))
                    return "skin: string expected";
            }
            if (message.nickname != null && Object.hasOwnProperty.call(message, "nickname")) {
                properties._nickname = 1;
                if (!$util.isString(message.nickname))
                    return "nickname: string expected";
            }
            if (message.body != null && Object.hasOwnProperty.call(message, "body")) {
                if (!Array.isArray(message.body))
                    return "body: array expected";
                for (let i = 0; i < message.body.length; ++i)
                    if (typeof message.body[i] !== "number")
                        return "body: number[] expected";
            }
            if (message.new_heads != null && Object.hasOwnProperty.call(message, "new_heads")) {
                if (!Array.isArray(message.new_heads))
                    return "new_heads: array expected";
                for (let i = 0; i < message.new_heads.length; ++i)
                    if (typeof message.new_heads[i] !== "number")
                        return "new_heads: number[] expected";
            }
            if (message.length != null && Object.hasOwnProperty.call(message, "length")) {
                properties._length = 1;
                if (!$util.isInteger(message.length))
                    return "length: integer expected";
            }
            return null;
        };

        /**
         * Creates a Player message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.Player
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.Player} Player
         */
        Player.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.Player)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.Player: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.Player();
            if (object.angle != null)
                message.angle = Number(object.angle);
            if (object.score != null)
                message.score = object.score | 0;
            if (object.kills != null)
                message.kills = object.kills | 0;
            if (object.deaths != null)
                message.deaths = object.deaths | 0;
            if (object.accelerating != null)
                message.accelerating = Boolean(object.accelerating);
            if (object.is_dead != null)
                message.is_dead = Boolean(object.is_dead);
            if (object.teleport_state != null)
                message.teleport_state = String(object.teleport_state);
            if (object.teleport_out_x != null)
                message.teleport_out_x = Number(object.teleport_out_x);
            if (object.teleport_out_y != null)
                message.teleport_out_y = Number(object.teleport_out_y);
            if (object.teleport_timer_ratio != null)
                message.teleport_timer_ratio = Number(object.teleport_timer_ratio);
            if (object.skin != null)
                message.skin = String(object.skin);
            if (object.nickname != null)
                message.nickname = String(object.nickname);
            if (object.body) {
                if (!Array.isArray(object.body))
                    throw TypeError(".snake.Player.body: array expected");
                message.body = [];
                for (let i = 0; i < object.body.length; ++i)
                    message.body[i] = Number(object.body[i]);
            }
            if (object.new_heads) {
                if (!Array.isArray(object.new_heads))
                    throw TypeError(".snake.Player.new_heads: array expected");
                message.new_heads = [];
                for (let i = 0; i < object.new_heads.length; ++i)
                    message.new_heads[i] = Number(object.new_heads[i]);
            }
            if (object.length != null)
                message.length = object.length | 0;
            return message;
        };

        /**
         * Creates a plain object from a Player message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.Player
         * @static
         * @param {snake.Player} message Player
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        Player.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.body = [];
                object.new_heads = [];
            }
            if (message.angle != null && Object.hasOwnProperty.call(message, "angle")) {
                object.angle = options.json && !isFinite(message.angle) ? String(message.angle) : message.angle;
                if (options.oneofs)
                    object._angle = "angle";
            }
            if (message.score != null && Object.hasOwnProperty.call(message, "score")) {
                object.score = message.score;
                if (options.oneofs)
                    object._score = "score";
            }
            if (message.kills != null && Object.hasOwnProperty.call(message, "kills")) {
                object.kills = message.kills;
                if (options.oneofs)
                    object._kills = "kills";
            }
            if (message.deaths != null && Object.hasOwnProperty.call(message, "deaths")) {
                object.deaths = message.deaths;
                if (options.oneofs)
                    object._deaths = "deaths";
            }
            if (message.accelerating != null && Object.hasOwnProperty.call(message, "accelerating")) {
                object.accelerating = message.accelerating;
                if (options.oneofs)
                    object._accelerating = "accelerating";
            }
            if (message.is_dead != null && Object.hasOwnProperty.call(message, "is_dead")) {
                object.is_dead = message.is_dead;
                if (options.oneofs)
                    object._is_dead = "is_dead";
            }
            if (message.teleport_state != null && Object.hasOwnProperty.call(message, "teleport_state")) {
                object.teleport_state = message.teleport_state;
                if (options.oneofs)
                    object._teleport_state = "teleport_state";
            }
            if (message.teleport_out_x != null && Object.hasOwnProperty.call(message, "teleport_out_x")) {
                object.teleport_out_x = options.json && !isFinite(message.teleport_out_x) ? String(message.teleport_out_x) : message.teleport_out_x;
                if (options.oneofs)
                    object._teleport_out_x = "teleport_out_x";
            }
            if (message.teleport_out_y != null && Object.hasOwnProperty.call(message, "teleport_out_y")) {
                object.teleport_out_y = options.json && !isFinite(message.teleport_out_y) ? String(message.teleport_out_y) : message.teleport_out_y;
                if (options.oneofs)
                    object._teleport_out_y = "teleport_out_y";
            }
            if (message.teleport_timer_ratio != null && Object.hasOwnProperty.call(message, "teleport_timer_ratio")) {
                object.teleport_timer_ratio = options.json && !isFinite(message.teleport_timer_ratio) ? String(message.teleport_timer_ratio) : message.teleport_timer_ratio;
                if (options.oneofs)
                    object._teleport_timer_ratio = "teleport_timer_ratio";
            }
            if (message.skin != null && Object.hasOwnProperty.call(message, "skin")) {
                object.skin = message.skin;
                if (options.oneofs)
                    object._skin = "skin";
            }
            if (message.nickname != null && Object.hasOwnProperty.call(message, "nickname")) {
                object.nickname = message.nickname;
                if (options.oneofs)
                    object._nickname = "nickname";
            }
            if (message.body && message.body.length) {
                object.body = [];
                for (let j = 0; j < message.body.length; ++j)
                    object.body[j] = options.json && !isFinite(message.body[j]) ? String(message.body[j]) : message.body[j];
            }
            if (message.new_heads && message.new_heads.length) {
                object.new_heads = [];
                for (let j = 0; j < message.new_heads.length; ++j)
                    object.new_heads[j] = options.json && !isFinite(message.new_heads[j]) ? String(message.new_heads[j]) : message.new_heads[j];
            }
            if (message.length != null && Object.hasOwnProperty.call(message, "length")) {
                object.length = message.length;
                if (options.oneofs)
                    object._length = "length";
            }
            return object;
        };

        /**
         * Converts this Player to JSON.
         * @function toJSON
         * @memberof snake.Player
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        Player.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for Player
         * @function getTypeUrl
         * @memberof snake.Player
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        Player.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.Player";
        };

        return Player;
    })();

    snake.GameStateFrame = (function() {

        /**
         * Properties of a GameStateFrame.
         * @memberof snake
         * @interface IGameStateFrame
         * @property {snake.GameStateFrame.FrameType|null} [type] GameStateFrame type
         * @property {number|null} [server_tick_rate] GameStateFrame server_tick_rate
         * @property {Object.<string,snake.IPlayer>|null} [players] GameStateFrame players
         * @property {Array.<snake.IFood>|null} [foods] GameStateFrame foods
         * @property {Array.<snake.IFood>|null} [new_foods] GameStateFrame new_foods
         * @property {Array.<number>|null} [eaten_foods] GameStateFrame eaten_foods
         * @property {Array.<snake.IMovedFood>|null} [moved_foods] GameStateFrame moved_foods
         * @property {Array.<snake.IKillEvent>|null} [kill_events] GameStateFrame kill_events
         * @property {Array.<snake.ITombstone>|null} [tombstones] GameStateFrame tombstones
         * @property {Array.<snake.IPortal>|null} [portals] GameStateFrame portals
         * @property {Array.<snake.IBlackHole>|null} [black_holes] GameStateFrame black_holes
         * @property {snake.IWorldConfig|null} [server_world] GameStateFrame server_world
         * @property {snake.ISimulationConfig|null} [server_simulation] GameStateFrame server_simulation
         * @property {snake.ISnakeConfig|null} [server_snake] GameStateFrame server_snake
         * @property {snake.IVisualConfig|null} [server_visual] GameStateFrame server_visual
         * @property {snake.IFoodConfig|null} [server_food] GameStateFrame server_food
         * @property {string|null} [your_id] GameStateFrame your_id
         * @property {string|null} [restart_message] GameStateFrame restart_message
         */

        /**
         * Constructs a new GameStateFrame.
         * @memberof snake
         * @classdesc Represents a GameStateFrame.
         * @implements IGameStateFrame
         * @constructor
         * @param {snake.IGameStateFrame=} [properties] Properties to set
         */
        function GameStateFrame(properties) {
            this.players = {};
            this.foods = [];
            this.new_foods = [];
            this.eaten_foods = [];
            this.moved_foods = [];
            this.kill_events = [];
            this.tombstones = [];
            this.portals = [];
            this.black_holes = [];
            if (properties)
                for (let keys = Object.keys(properties), i = 0; i < keys.length; ++i)
                    if (properties[keys[i]] != null && keys[i] !== "__proto__")
                        this[keys[i]] = properties[keys[i]];
        }

        /**
         * GameStateFrame type.
         * @member {snake.GameStateFrame.FrameType|null|undefined} type
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.type = null;

        /**
         * GameStateFrame server_tick_rate.
         * @member {number|null|undefined} server_tick_rate
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.server_tick_rate = null;

        /**
         * GameStateFrame players.
         * @member {Object.<string,snake.IPlayer>} players
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.players = $util.emptyObject;

        /**
         * GameStateFrame foods.
         * @member {Array.<snake.IFood>} foods
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.foods = $util.emptyArray;

        /**
         * GameStateFrame new_foods.
         * @member {Array.<snake.IFood>} new_foods
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.new_foods = $util.emptyArray;

        /**
         * GameStateFrame eaten_foods.
         * @member {Array.<number>} eaten_foods
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.eaten_foods = $util.emptyArray;

        /**
         * GameStateFrame moved_foods.
         * @member {Array.<snake.IMovedFood>} moved_foods
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.moved_foods = $util.emptyArray;

        /**
         * GameStateFrame kill_events.
         * @member {Array.<snake.IKillEvent>} kill_events
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.kill_events = $util.emptyArray;

        /**
         * GameStateFrame tombstones.
         * @member {Array.<snake.ITombstone>} tombstones
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.tombstones = $util.emptyArray;

        /**
         * GameStateFrame portals.
         * @member {Array.<snake.IPortal>} portals
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.portals = $util.emptyArray;

        /**
         * GameStateFrame black_holes.
         * @member {Array.<snake.IBlackHole>} black_holes
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.black_holes = $util.emptyArray;

        /**
         * GameStateFrame server_world.
         * @member {snake.IWorldConfig|null|undefined} server_world
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.server_world = null;

        /**
         * GameStateFrame server_simulation.
         * @member {snake.ISimulationConfig|null|undefined} server_simulation
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.server_simulation = null;

        /**
         * GameStateFrame server_snake.
         * @member {snake.ISnakeConfig|null|undefined} server_snake
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.server_snake = null;

        /**
         * GameStateFrame server_visual.
         * @member {snake.IVisualConfig|null|undefined} server_visual
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.server_visual = null;

        /**
         * GameStateFrame server_food.
         * @member {snake.IFoodConfig|null|undefined} server_food
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.server_food = null;

        /**
         * GameStateFrame your_id.
         * @member {string|null|undefined} your_id
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.your_id = null;

        /**
         * GameStateFrame restart_message.
         * @member {string|null|undefined} restart_message
         * @memberof snake.GameStateFrame
         * @instance
         */
        GameStateFrame.prototype.restart_message = null;

        // OneOf field names bound to virtual getters and setters
        let $oneOfFields;

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(GameStateFrame.prototype, "_type", {
            get: $util.oneOfGetter($oneOfFields = ["type"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(GameStateFrame.prototype, "_server_tick_rate", {
            get: $util.oneOfGetter($oneOfFields = ["server_tick_rate"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(GameStateFrame.prototype, "_server_world", {
            get: $util.oneOfGetter($oneOfFields = ["server_world"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(GameStateFrame.prototype, "_server_simulation", {
            get: $util.oneOfGetter($oneOfFields = ["server_simulation"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(GameStateFrame.prototype, "_server_snake", {
            get: $util.oneOfGetter($oneOfFields = ["server_snake"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(GameStateFrame.prototype, "_server_visual", {
            get: $util.oneOfGetter($oneOfFields = ["server_visual"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(GameStateFrame.prototype, "_server_food", {
            get: $util.oneOfGetter($oneOfFields = ["server_food"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(GameStateFrame.prototype, "_your_id", {
            get: $util.oneOfGetter($oneOfFields = ["your_id"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        // Virtual OneOf for proto3 optional field
        Object.defineProperty(GameStateFrame.prototype, "_restart_message", {
            get: $util.oneOfGetter($oneOfFields = ["restart_message"]),
            set: $util.oneOfSetter($oneOfFields)
        });

        /**
         * Creates a new GameStateFrame instance using the specified properties.
         * @function create
         * @memberof snake.GameStateFrame
         * @static
         * @param {snake.IGameStateFrame=} [properties] Properties to set
         * @returns {snake.GameStateFrame} GameStateFrame instance
         */
        GameStateFrame.create = function create(properties) {
            return new GameStateFrame(properties);
        };

        /**
         * Encodes the specified GameStateFrame message. Does not implicitly {@link snake.GameStateFrame.verify|verify} messages.
         * @function encode
         * @memberof snake.GameStateFrame
         * @static
         * @param {snake.IGameStateFrame} message GameStateFrame message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GameStateFrame.encode = function encode(message, writer, q) {
            if (!writer)
                writer = $Writer.create();
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            if (message.type != null && Object.hasOwnProperty.call(message, "type"))
                writer.uint32(/* id 1, wireType 0 =*/8).int32(message.type);
            if (message.server_tick_rate != null && Object.hasOwnProperty.call(message, "server_tick_rate"))
                writer.uint32(/* id 2, wireType 0 =*/16).int32(message.server_tick_rate);
            if (message.players != null && Object.hasOwnProperty.call(message, "players"))
                for (let keys = Object.keys(message.players), i = 0; i < keys.length; ++i) {
                    writer.uint32(/* id 3, wireType 2 =*/26).fork().uint32(/* id 1, wireType 2 =*/10).string(keys[i]);
                    $root.snake.Player.encode(message.players[keys[i]], writer.uint32(/* id 2, wireType 2 =*/18).fork(), q + 1).ldelim().ldelim();
                }
            if (message.foods != null && message.foods.length)
                for (let i = 0; i < message.foods.length; ++i)
                    $root.snake.Food.encode(message.foods[i], writer.uint32(/* id 4, wireType 2 =*/34).fork(), q + 1).ldelim();
            if (message.new_foods != null && message.new_foods.length)
                for (let i = 0; i < message.new_foods.length; ++i)
                    $root.snake.Food.encode(message.new_foods[i], writer.uint32(/* id 5, wireType 2 =*/42).fork(), q + 1).ldelim();
            if (message.eaten_foods != null && message.eaten_foods.length) {
                writer.uint32(/* id 6, wireType 2 =*/50).fork();
                for (let i = 0; i < message.eaten_foods.length; ++i)
                    writer.int32(message.eaten_foods[i]);
                writer.ldelim();
            }
            if (message.moved_foods != null && message.moved_foods.length)
                for (let i = 0; i < message.moved_foods.length; ++i)
                    $root.snake.MovedFood.encode(message.moved_foods[i], writer.uint32(/* id 7, wireType 2 =*/58).fork(), q + 1).ldelim();
            if (message.kill_events != null && message.kill_events.length)
                for (let i = 0; i < message.kill_events.length; ++i)
                    $root.snake.KillEvent.encode(message.kill_events[i], writer.uint32(/* id 8, wireType 2 =*/66).fork(), q + 1).ldelim();
            if (message.tombstones != null && message.tombstones.length)
                for (let i = 0; i < message.tombstones.length; ++i)
                    $root.snake.Tombstone.encode(message.tombstones[i], writer.uint32(/* id 9, wireType 2 =*/74).fork(), q + 1).ldelim();
            if (message.portals != null && message.portals.length)
                for (let i = 0; i < message.portals.length; ++i)
                    $root.snake.Portal.encode(message.portals[i], writer.uint32(/* id 10, wireType 2 =*/82).fork(), q + 1).ldelim();
            if (message.black_holes != null && message.black_holes.length)
                for (let i = 0; i < message.black_holes.length; ++i)
                    $root.snake.BlackHole.encode(message.black_holes[i], writer.uint32(/* id 11, wireType 2 =*/90).fork(), q + 1).ldelim();
            if (message.server_world != null && Object.hasOwnProperty.call(message, "server_world"))
                $root.snake.WorldConfig.encode(message.server_world, writer.uint32(/* id 12, wireType 2 =*/98).fork(), q + 1).ldelim();
            if (message.server_simulation != null && Object.hasOwnProperty.call(message, "server_simulation"))
                $root.snake.SimulationConfig.encode(message.server_simulation, writer.uint32(/* id 13, wireType 2 =*/106).fork(), q + 1).ldelim();
            if (message.server_snake != null && Object.hasOwnProperty.call(message, "server_snake"))
                $root.snake.SnakeConfig.encode(message.server_snake, writer.uint32(/* id 14, wireType 2 =*/114).fork(), q + 1).ldelim();
            if (message.server_visual != null && Object.hasOwnProperty.call(message, "server_visual"))
                $root.snake.VisualConfig.encode(message.server_visual, writer.uint32(/* id 15, wireType 2 =*/122).fork(), q + 1).ldelim();
            if (message.server_food != null && Object.hasOwnProperty.call(message, "server_food"))
                $root.snake.FoodConfig.encode(message.server_food, writer.uint32(/* id 16, wireType 2 =*/130).fork(), q + 1).ldelim();
            if (message.your_id != null && Object.hasOwnProperty.call(message, "your_id"))
                writer.uint32(/* id 17, wireType 2 =*/138).string(message.your_id);
            if (message.restart_message != null && Object.hasOwnProperty.call(message, "restart_message"))
                writer.uint32(/* id 18, wireType 2 =*/146).string(message.restart_message);
            return writer;
        };

        /**
         * Encodes the specified GameStateFrame message, length delimited. Does not implicitly {@link snake.GameStateFrame.verify|verify} messages.
         * @function encodeDelimited
         * @memberof snake.GameStateFrame
         * @static
         * @param {snake.IGameStateFrame} message GameStateFrame message or plain object to encode
         * @param {$protobuf.Writer} [writer] Writer to encode to
         * @returns {$protobuf.Writer} Writer
         */
        GameStateFrame.encodeDelimited = function encodeDelimited(message, writer) {
            return this.encode(message, writer && writer.len ? writer.fork() : writer).ldelim();
        };

        /**
         * Decodes a GameStateFrame message from the specified reader or buffer.
         * @function decode
         * @memberof snake.GameStateFrame
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @param {number} [length] Message length if known beforehand
         * @returns {snake.GameStateFrame} GameStateFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GameStateFrame.decode = function decode(reader, length, error, long) {
            if (!(reader instanceof $Reader))
                reader = $Reader.create(reader);
            if (long === undefined)
                long = 0;
            if (long > $Reader.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let end = length === undefined ? reader.len : reader.pos + length, message = new $root.snake.GameStateFrame(), key, value;
            while (reader.pos < end) {
                let tag = reader.uint32();
                if (tag === error)
                    break;
                switch (tag >>> 3) {
                case 1: {
                        message.type = reader.int32();
                        break;
                    }
                case 2: {
                        message.server_tick_rate = reader.int32();
                        break;
                    }
                case 3: {
                        if (message.players === $util.emptyObject)
                            message.players = {};
                        let end2 = reader.uint32() + reader.pos;
                        key = "";
                        value = null;
                        while (reader.pos < end2) {
                            let tag2 = reader.uint32();
                            switch (tag2 >>> 3) {
                            case 1:
                                key = reader.string();
                                break;
                            case 2:
                                value = $root.snake.Player.decode(reader, reader.uint32(), undefined, long + 1);
                                break;
                            default:
                                reader.skipType(tag2 & 7, long);
                                break;
                            }
                        }
                        if (key === "__proto__")
                            $util.makeProp(message.players, key);
                        message.players[key] = value;
                        break;
                    }
                case 4: {
                        if (!(message.foods && message.foods.length))
                            message.foods = [];
                        message.foods.push($root.snake.Food.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 5: {
                        if (!(message.new_foods && message.new_foods.length))
                            message.new_foods = [];
                        message.new_foods.push($root.snake.Food.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 6: {
                        if (!(message.eaten_foods && message.eaten_foods.length))
                            message.eaten_foods = [];
                        if ((tag & 7) === 2) {
                            let end2 = reader.uint32() + reader.pos;
                            while (reader.pos < end2)
                                message.eaten_foods.push(reader.int32());
                        } else
                            message.eaten_foods.push(reader.int32());
                        break;
                    }
                case 7: {
                        if (!(message.moved_foods && message.moved_foods.length))
                            message.moved_foods = [];
                        message.moved_foods.push($root.snake.MovedFood.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 8: {
                        if (!(message.kill_events && message.kill_events.length))
                            message.kill_events = [];
                        message.kill_events.push($root.snake.KillEvent.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 9: {
                        if (!(message.tombstones && message.tombstones.length))
                            message.tombstones = [];
                        message.tombstones.push($root.snake.Tombstone.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 10: {
                        if (!(message.portals && message.portals.length))
                            message.portals = [];
                        message.portals.push($root.snake.Portal.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 11: {
                        if (!(message.black_holes && message.black_holes.length))
                            message.black_holes = [];
                        message.black_holes.push($root.snake.BlackHole.decode(reader, reader.uint32(), undefined, long + 1));
                        break;
                    }
                case 12: {
                        message.server_world = $root.snake.WorldConfig.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 13: {
                        message.server_simulation = $root.snake.SimulationConfig.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 14: {
                        message.server_snake = $root.snake.SnakeConfig.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 15: {
                        message.server_visual = $root.snake.VisualConfig.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 16: {
                        message.server_food = $root.snake.FoodConfig.decode(reader, reader.uint32(), undefined, long + 1);
                        break;
                    }
                case 17: {
                        message.your_id = reader.string();
                        break;
                    }
                case 18: {
                        message.restart_message = reader.string();
                        break;
                    }
                default:
                    reader.skipType(tag & 7, long);
                    break;
                }
            }
            return message;
        };

        /**
         * Decodes a GameStateFrame message from the specified reader or buffer, length delimited.
         * @function decodeDelimited
         * @memberof snake.GameStateFrame
         * @static
         * @param {$protobuf.Reader|Uint8Array} reader Reader or buffer to decode from
         * @returns {snake.GameStateFrame} GameStateFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        GameStateFrame.decodeDelimited = function decodeDelimited(reader) {
            if (!(reader instanceof $Reader))
                reader = new $Reader(reader);
            return this.decode(reader, reader.uint32());
        };

        /**
         * Verifies a GameStateFrame message.
         * @function verify
         * @memberof snake.GameStateFrame
         * @static
         * @param {Object.<string,*>} message Plain object to verify
         * @returns {string|null} `null` if valid, otherwise the reason why it is not
         */
        GameStateFrame.verify = function verify(message, long) {
            if (typeof message !== "object" || message === null)
                return "object expected";
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                return "maximum nesting depth exceeded";
            let properties = {};
            if (message.type != null && Object.hasOwnProperty.call(message, "type")) {
                properties._type = 1;
                switch (message.type) {
                default:
                    return "type: enum value expected";
                case 0:
                case 1:
                case 2:
                case 3:
                    break;
                }
            }
            if (message.server_tick_rate != null && Object.hasOwnProperty.call(message, "server_tick_rate")) {
                properties._server_tick_rate = 1;
                if (!$util.isInteger(message.server_tick_rate))
                    return "server_tick_rate: integer expected";
            }
            if (message.players != null && Object.hasOwnProperty.call(message, "players")) {
                if (!$util.isObject(message.players))
                    return "players: object expected";
                let key = Object.keys(message.players);
                for (let i = 0; i < key.length; ++i) {
                    let error = $root.snake.Player.verify(message.players[key[i]], long + 1);
                    if (error)
                        return "players." + error;
                }
            }
            if (message.foods != null && Object.hasOwnProperty.call(message, "foods")) {
                if (!Array.isArray(message.foods))
                    return "foods: array expected";
                for (let i = 0; i < message.foods.length; ++i) {
                    let error = $root.snake.Food.verify(message.foods[i], long + 1);
                    if (error)
                        return "foods." + error;
                }
            }
            if (message.new_foods != null && Object.hasOwnProperty.call(message, "new_foods")) {
                if (!Array.isArray(message.new_foods))
                    return "new_foods: array expected";
                for (let i = 0; i < message.new_foods.length; ++i) {
                    let error = $root.snake.Food.verify(message.new_foods[i], long + 1);
                    if (error)
                        return "new_foods." + error;
                }
            }
            if (message.eaten_foods != null && Object.hasOwnProperty.call(message, "eaten_foods")) {
                if (!Array.isArray(message.eaten_foods))
                    return "eaten_foods: array expected";
                for (let i = 0; i < message.eaten_foods.length; ++i)
                    if (!$util.isInteger(message.eaten_foods[i]))
                        return "eaten_foods: integer[] expected";
            }
            if (message.moved_foods != null && Object.hasOwnProperty.call(message, "moved_foods")) {
                if (!Array.isArray(message.moved_foods))
                    return "moved_foods: array expected";
                for (let i = 0; i < message.moved_foods.length; ++i) {
                    let error = $root.snake.MovedFood.verify(message.moved_foods[i], long + 1);
                    if (error)
                        return "moved_foods." + error;
                }
            }
            if (message.kill_events != null && Object.hasOwnProperty.call(message, "kill_events")) {
                if (!Array.isArray(message.kill_events))
                    return "kill_events: array expected";
                for (let i = 0; i < message.kill_events.length; ++i) {
                    let error = $root.snake.KillEvent.verify(message.kill_events[i], long + 1);
                    if (error)
                        return "kill_events." + error;
                }
            }
            if (message.tombstones != null && Object.hasOwnProperty.call(message, "tombstones")) {
                if (!Array.isArray(message.tombstones))
                    return "tombstones: array expected";
                for (let i = 0; i < message.tombstones.length; ++i) {
                    let error = $root.snake.Tombstone.verify(message.tombstones[i], long + 1);
                    if (error)
                        return "tombstones." + error;
                }
            }
            if (message.portals != null && Object.hasOwnProperty.call(message, "portals")) {
                if (!Array.isArray(message.portals))
                    return "portals: array expected";
                for (let i = 0; i < message.portals.length; ++i) {
                    let error = $root.snake.Portal.verify(message.portals[i], long + 1);
                    if (error)
                        return "portals." + error;
                }
            }
            if (message.black_holes != null && Object.hasOwnProperty.call(message, "black_holes")) {
                if (!Array.isArray(message.black_holes))
                    return "black_holes: array expected";
                for (let i = 0; i < message.black_holes.length; ++i) {
                    let error = $root.snake.BlackHole.verify(message.black_holes[i], long + 1);
                    if (error)
                        return "black_holes." + error;
                }
            }
            if (message.server_world != null && Object.hasOwnProperty.call(message, "server_world")) {
                properties._server_world = 1;
                {
                    let error = $root.snake.WorldConfig.verify(message.server_world, long + 1);
                    if (error)
                        return "server_world." + error;
                }
            }
            if (message.server_simulation != null && Object.hasOwnProperty.call(message, "server_simulation")) {
                properties._server_simulation = 1;
                {
                    let error = $root.snake.SimulationConfig.verify(message.server_simulation, long + 1);
                    if (error)
                        return "server_simulation." + error;
                }
            }
            if (message.server_snake != null && Object.hasOwnProperty.call(message, "server_snake")) {
                properties._server_snake = 1;
                {
                    let error = $root.snake.SnakeConfig.verify(message.server_snake, long + 1);
                    if (error)
                        return "server_snake." + error;
                }
            }
            if (message.server_visual != null && Object.hasOwnProperty.call(message, "server_visual")) {
                properties._server_visual = 1;
                {
                    let error = $root.snake.VisualConfig.verify(message.server_visual, long + 1);
                    if (error)
                        return "server_visual." + error;
                }
            }
            if (message.server_food != null && Object.hasOwnProperty.call(message, "server_food")) {
                properties._server_food = 1;
                {
                    let error = $root.snake.FoodConfig.verify(message.server_food, long + 1);
                    if (error)
                        return "server_food." + error;
                }
            }
            if (message.your_id != null && Object.hasOwnProperty.call(message, "your_id")) {
                properties._your_id = 1;
                if (!$util.isString(message.your_id))
                    return "your_id: string expected";
            }
            if (message.restart_message != null && Object.hasOwnProperty.call(message, "restart_message")) {
                properties._restart_message = 1;
                if (!$util.isString(message.restart_message))
                    return "restart_message: string expected";
            }
            return null;
        };

        /**
         * Creates a GameStateFrame message from a plain object. Also converts values to their respective internal types.
         * @function fromObject
         * @memberof snake.GameStateFrame
         * @static
         * @param {Object.<string,*>} object Plain object
         * @returns {snake.GameStateFrame} GameStateFrame
         */
        GameStateFrame.fromObject = function fromObject(object, long) {
            if (object instanceof $root.snake.GameStateFrame)
                return object;
            if (!$util.isObject(object))
                throw TypeError(".snake.GameStateFrame: object expected");
            if (long === undefined)
                long = 0;
            if (long > $util.recursionLimit)
                throw Error("maximum nesting depth exceeded");
            let message = new $root.snake.GameStateFrame();
            switch (object.type) {
            default:
                if (typeof object.type === "number") {
                    message.type = object.type;
                    break;
                }
                break;
            case "UNKNOWN":
            case 0:
                message.type = 0;
                break;
            case "FULL":
            case 1:
                message.type = 1;
                break;
            case "DELTA":
            case 2:
                message.type = 2;
                break;
            case "SERVER_RESTART":
            case 3:
                message.type = 3;
                break;
            }
            if (object.server_tick_rate != null)
                message.server_tick_rate = object.server_tick_rate | 0;
            if (object.players) {
                if (!$util.isObject(object.players))
                    throw TypeError(".snake.GameStateFrame.players: object expected");
                message.players = {};
                for (let keys = Object.keys(object.players), i = 0; i < keys.length; ++i) {
                    if (keys[i] === "__proto__")
                        $util.makeProp(message.players, keys[i]);
                    if (!$util.isObject(object.players[keys[i]]))
                        throw TypeError(".snake.GameStateFrame.players: object expected");
                    message.players[keys[i]] = $root.snake.Player.fromObject(object.players[keys[i]], long + 1);
                }
            }
            if (object.foods) {
                if (!Array.isArray(object.foods))
                    throw TypeError(".snake.GameStateFrame.foods: array expected");
                message.foods = [];
                for (let i = 0; i < object.foods.length; ++i) {
                    if (!$util.isObject(object.foods[i]))
                        throw TypeError(".snake.GameStateFrame.foods: object expected");
                    message.foods[i] = $root.snake.Food.fromObject(object.foods[i], long + 1);
                }
            }
            if (object.new_foods) {
                if (!Array.isArray(object.new_foods))
                    throw TypeError(".snake.GameStateFrame.new_foods: array expected");
                message.new_foods = [];
                for (let i = 0; i < object.new_foods.length; ++i) {
                    if (!$util.isObject(object.new_foods[i]))
                        throw TypeError(".snake.GameStateFrame.new_foods: object expected");
                    message.new_foods[i] = $root.snake.Food.fromObject(object.new_foods[i], long + 1);
                }
            }
            if (object.eaten_foods) {
                if (!Array.isArray(object.eaten_foods))
                    throw TypeError(".snake.GameStateFrame.eaten_foods: array expected");
                message.eaten_foods = [];
                for (let i = 0; i < object.eaten_foods.length; ++i)
                    message.eaten_foods[i] = object.eaten_foods[i] | 0;
            }
            if (object.moved_foods) {
                if (!Array.isArray(object.moved_foods))
                    throw TypeError(".snake.GameStateFrame.moved_foods: array expected");
                message.moved_foods = [];
                for (let i = 0; i < object.moved_foods.length; ++i) {
                    if (!$util.isObject(object.moved_foods[i]))
                        throw TypeError(".snake.GameStateFrame.moved_foods: object expected");
                    message.moved_foods[i] = $root.snake.MovedFood.fromObject(object.moved_foods[i], long + 1);
                }
            }
            if (object.kill_events) {
                if (!Array.isArray(object.kill_events))
                    throw TypeError(".snake.GameStateFrame.kill_events: array expected");
                message.kill_events = [];
                for (let i = 0; i < object.kill_events.length; ++i) {
                    if (!$util.isObject(object.kill_events[i]))
                        throw TypeError(".snake.GameStateFrame.kill_events: object expected");
                    message.kill_events[i] = $root.snake.KillEvent.fromObject(object.kill_events[i], long + 1);
                }
            }
            if (object.tombstones) {
                if (!Array.isArray(object.tombstones))
                    throw TypeError(".snake.GameStateFrame.tombstones: array expected");
                message.tombstones = [];
                for (let i = 0; i < object.tombstones.length; ++i) {
                    if (!$util.isObject(object.tombstones[i]))
                        throw TypeError(".snake.GameStateFrame.tombstones: object expected");
                    message.tombstones[i] = $root.snake.Tombstone.fromObject(object.tombstones[i], long + 1);
                }
            }
            if (object.portals) {
                if (!Array.isArray(object.portals))
                    throw TypeError(".snake.GameStateFrame.portals: array expected");
                message.portals = [];
                for (let i = 0; i < object.portals.length; ++i) {
                    if (!$util.isObject(object.portals[i]))
                        throw TypeError(".snake.GameStateFrame.portals: object expected");
                    message.portals[i] = $root.snake.Portal.fromObject(object.portals[i], long + 1);
                }
            }
            if (object.black_holes) {
                if (!Array.isArray(object.black_holes))
                    throw TypeError(".snake.GameStateFrame.black_holes: array expected");
                message.black_holes = [];
                for (let i = 0; i < object.black_holes.length; ++i) {
                    if (!$util.isObject(object.black_holes[i]))
                        throw TypeError(".snake.GameStateFrame.black_holes: object expected");
                    message.black_holes[i] = $root.snake.BlackHole.fromObject(object.black_holes[i], long + 1);
                }
            }
            if (object.server_world != null) {
                if (!$util.isObject(object.server_world))
                    throw TypeError(".snake.GameStateFrame.server_world: object expected");
                message.server_world = $root.snake.WorldConfig.fromObject(object.server_world, long + 1);
            }
            if (object.server_simulation != null) {
                if (!$util.isObject(object.server_simulation))
                    throw TypeError(".snake.GameStateFrame.server_simulation: object expected");
                message.server_simulation = $root.snake.SimulationConfig.fromObject(object.server_simulation, long + 1);
            }
            if (object.server_snake != null) {
                if (!$util.isObject(object.server_snake))
                    throw TypeError(".snake.GameStateFrame.server_snake: object expected");
                message.server_snake = $root.snake.SnakeConfig.fromObject(object.server_snake, long + 1);
            }
            if (object.server_visual != null) {
                if (!$util.isObject(object.server_visual))
                    throw TypeError(".snake.GameStateFrame.server_visual: object expected");
                message.server_visual = $root.snake.VisualConfig.fromObject(object.server_visual, long + 1);
            }
            if (object.server_food != null) {
                if (!$util.isObject(object.server_food))
                    throw TypeError(".snake.GameStateFrame.server_food: object expected");
                message.server_food = $root.snake.FoodConfig.fromObject(object.server_food, long + 1);
            }
            if (object.your_id != null)
                message.your_id = String(object.your_id);
            if (object.restart_message != null)
                message.restart_message = String(object.restart_message);
            return message;
        };

        /**
         * Creates a plain object from a GameStateFrame message. Also converts values to other types if specified.
         * @function toObject
         * @memberof snake.GameStateFrame
         * @static
         * @param {snake.GameStateFrame} message GameStateFrame
         * @param {$protobuf.IConversionOptions} [options] Conversion options
         * @returns {Object.<string,*>} Plain object
         */
        GameStateFrame.toObject = function toObject(message, options, q) {
            if (!options)
                options = {};
            if (q === undefined)
                q = 0;
            if (q > $util.recursionLimit)
                throw Error("max depth exceeded");
            let object = {};
            if (options.arrays || options.defaults) {
                object.foods = [];
                object.new_foods = [];
                object.eaten_foods = [];
                object.moved_foods = [];
                object.kill_events = [];
                object.tombstones = [];
                object.portals = [];
                object.black_holes = [];
            }
            if (options.objects || options.defaults)
                object.players = {};
            if (message.type != null && Object.hasOwnProperty.call(message, "type")) {
                object.type = options.enums === String ? $root.snake.GameStateFrame.FrameType[message.type] === undefined ? message.type : $root.snake.GameStateFrame.FrameType[message.type] : message.type;
                if (options.oneofs)
                    object._type = "type";
            }
            if (message.server_tick_rate != null && Object.hasOwnProperty.call(message, "server_tick_rate")) {
                object.server_tick_rate = message.server_tick_rate;
                if (options.oneofs)
                    object._server_tick_rate = "server_tick_rate";
            }
            let keys2;
            if (message.players && (keys2 = Object.keys(message.players)).length) {
                object.players = {};
                for (let j = 0; j < keys2.length; ++j) {
                    if (keys2[j] === "__proto__")
                        $util.makeProp(object.players, keys2[j]);
                    object.players[keys2[j]] = $root.snake.Player.toObject(message.players[keys2[j]], options, q + 1);
                }
            }
            if (message.foods && message.foods.length) {
                object.foods = [];
                for (let j = 0; j < message.foods.length; ++j)
                    object.foods[j] = $root.snake.Food.toObject(message.foods[j], options, q + 1);
            }
            if (message.new_foods && message.new_foods.length) {
                object.new_foods = [];
                for (let j = 0; j < message.new_foods.length; ++j)
                    object.new_foods[j] = $root.snake.Food.toObject(message.new_foods[j], options, q + 1);
            }
            if (message.eaten_foods && message.eaten_foods.length) {
                object.eaten_foods = [];
                for (let j = 0; j < message.eaten_foods.length; ++j)
                    object.eaten_foods[j] = message.eaten_foods[j];
            }
            if (message.moved_foods && message.moved_foods.length) {
                object.moved_foods = [];
                for (let j = 0; j < message.moved_foods.length; ++j)
                    object.moved_foods[j] = $root.snake.MovedFood.toObject(message.moved_foods[j], options, q + 1);
            }
            if (message.kill_events && message.kill_events.length) {
                object.kill_events = [];
                for (let j = 0; j < message.kill_events.length; ++j)
                    object.kill_events[j] = $root.snake.KillEvent.toObject(message.kill_events[j], options, q + 1);
            }
            if (message.tombstones && message.tombstones.length) {
                object.tombstones = [];
                for (let j = 0; j < message.tombstones.length; ++j)
                    object.tombstones[j] = $root.snake.Tombstone.toObject(message.tombstones[j], options, q + 1);
            }
            if (message.portals && message.portals.length) {
                object.portals = [];
                for (let j = 0; j < message.portals.length; ++j)
                    object.portals[j] = $root.snake.Portal.toObject(message.portals[j], options, q + 1);
            }
            if (message.black_holes && message.black_holes.length) {
                object.black_holes = [];
                for (let j = 0; j < message.black_holes.length; ++j)
                    object.black_holes[j] = $root.snake.BlackHole.toObject(message.black_holes[j], options, q + 1);
            }
            if (message.server_world != null && Object.hasOwnProperty.call(message, "server_world")) {
                object.server_world = $root.snake.WorldConfig.toObject(message.server_world, options, q + 1);
                if (options.oneofs)
                    object._server_world = "server_world";
            }
            if (message.server_simulation != null && Object.hasOwnProperty.call(message, "server_simulation")) {
                object.server_simulation = $root.snake.SimulationConfig.toObject(message.server_simulation, options, q + 1);
                if (options.oneofs)
                    object._server_simulation = "server_simulation";
            }
            if (message.server_snake != null && Object.hasOwnProperty.call(message, "server_snake")) {
                object.server_snake = $root.snake.SnakeConfig.toObject(message.server_snake, options, q + 1);
                if (options.oneofs)
                    object._server_snake = "server_snake";
            }
            if (message.server_visual != null && Object.hasOwnProperty.call(message, "server_visual")) {
                object.server_visual = $root.snake.VisualConfig.toObject(message.server_visual, options, q + 1);
                if (options.oneofs)
                    object._server_visual = "server_visual";
            }
            if (message.server_food != null && Object.hasOwnProperty.call(message, "server_food")) {
                object.server_food = $root.snake.FoodConfig.toObject(message.server_food, options, q + 1);
                if (options.oneofs)
                    object._server_food = "server_food";
            }
            if (message.your_id != null && Object.hasOwnProperty.call(message, "your_id")) {
                object.your_id = message.your_id;
                if (options.oneofs)
                    object._your_id = "your_id";
            }
            if (message.restart_message != null && Object.hasOwnProperty.call(message, "restart_message")) {
                object.restart_message = message.restart_message;
                if (options.oneofs)
                    object._restart_message = "restart_message";
            }
            return object;
        };

        /**
         * Converts this GameStateFrame to JSON.
         * @function toJSON
         * @memberof snake.GameStateFrame
         * @instance
         * @returns {Object.<string,*>} JSON object
         */
        GameStateFrame.prototype.toJSON = function toJSON() {
            return this.constructor.toObject(this, $protobuf.util.toJSONOptions);
        };

        /**
         * Gets the default type url for GameStateFrame
         * @function getTypeUrl
         * @memberof snake.GameStateFrame
         * @static
         * @param {string} [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns {string} The default type url
         */
        GameStateFrame.getTypeUrl = function getTypeUrl(typeUrlPrefix) {
            if (typeUrlPrefix === undefined) {
                typeUrlPrefix = "type.googleapis.com";
            }
            return typeUrlPrefix + "/snake.GameStateFrame";
        };

        /**
         * FrameType enum.
         * @name snake.GameStateFrame.FrameType
         * @enum {number}
         * @property {number} UNKNOWN=0 UNKNOWN value
         * @property {number} FULL=1 FULL value
         * @property {number} DELTA=2 DELTA value
         * @property {number} SERVER_RESTART=3 SERVER_RESTART value
         */
        GameStateFrame.FrameType = (function() {
            const valuesById = {}, values = Object.create(valuesById);
            values[valuesById[0] = "UNKNOWN"] = 0;
            values[valuesById[1] = "FULL"] = 1;
            values[valuesById[2] = "DELTA"] = 2;
            values[valuesById[3] = "SERVER_RESTART"] = 3;
            return values;
        })();

        return GameStateFrame;
    })();

    return snake;
})();

export { $root as default };
