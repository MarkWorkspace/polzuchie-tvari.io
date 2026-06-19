import * as $protobuf from "protobufjs";
import Long = require("long");
/** Namespace snake. */
export namespace snake {

    /** Properties of a WorldConfig. */
    interface IWorldConfig {

        /** WorldConfig width */
        width?: (number|null);

        /** WorldConfig height */
        height?: (number|null);

        /** WorldConfig portals_enabled */
        portals_enabled?: (number|null);

        /** WorldConfig portals_count */
        portals_count?: (number|null);

        /** WorldConfig portals_radius */
        portals_radius?: (number|null);

        /** WorldConfig portals_teleport_delay_ms */
        portals_teleport_delay_ms?: (number|null);

        /** WorldConfig portals_spawn_chance */
        portals_spawn_chance?: (number|null);

        /** WorldConfig portals_growth_time */
        portals_growth_time?: (number|null);

        /** WorldConfig black_holes_enabled */
        black_holes_enabled?: (number|null);

        /** WorldConfig black_holes_count */
        black_holes_count?: (number|null);

        /** WorldConfig black_holes_spawn_chance */
        black_holes_spawn_chance?: (number|null);

        /** WorldConfig black_holes_pull_radius */
        black_holes_pull_radius?: (number|null);

        /** WorldConfig black_holes_pull_force */
        black_holes_pull_force?: (number|null);

        /** WorldConfig black_holes_kill_radius */
        black_holes_kill_radius?: (number|null);

        /** WorldConfig black_holes_growth_time */
        black_holes_growth_time?: (number|null);
    }

    /** Represents a WorldConfig. */
    class WorldConfig implements IWorldConfig {

        /**
         * Constructs a new WorldConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IWorldConfig);

        /** WorldConfig width. */
        public width?: (number|null);

        /** WorldConfig height. */
        public height?: (number|null);

        /** WorldConfig portals_enabled. */
        public portals_enabled?: (number|null);

        /** WorldConfig portals_count. */
        public portals_count?: (number|null);

        /** WorldConfig portals_radius. */
        public portals_radius?: (number|null);

        /** WorldConfig portals_teleport_delay_ms. */
        public portals_teleport_delay_ms?: (number|null);

        /** WorldConfig portals_spawn_chance. */
        public portals_spawn_chance?: (number|null);

        /** WorldConfig portals_growth_time. */
        public portals_growth_time?: (number|null);

        /** WorldConfig black_holes_enabled. */
        public black_holes_enabled?: (number|null);

        /** WorldConfig black_holes_count. */
        public black_holes_count?: (number|null);

        /** WorldConfig black_holes_spawn_chance. */
        public black_holes_spawn_chance?: (number|null);

        /** WorldConfig black_holes_pull_radius. */
        public black_holes_pull_radius?: (number|null);

        /** WorldConfig black_holes_pull_force. */
        public black_holes_pull_force?: (number|null);

        /** WorldConfig black_holes_kill_radius. */
        public black_holes_kill_radius?: (number|null);

        /** WorldConfig black_holes_growth_time. */
        public black_holes_growth_time?: (number|null);

        /**
         * Creates a new WorldConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns WorldConfig instance
         */
        public static create(properties?: snake.IWorldConfig): snake.WorldConfig;

        /**
         * Encodes the specified WorldConfig message. Does not implicitly {@link snake.WorldConfig.verify|verify} messages.
         * @param message WorldConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IWorldConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified WorldConfig message, length delimited. Does not implicitly {@link snake.WorldConfig.verify|verify} messages.
         * @param message WorldConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IWorldConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a WorldConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns WorldConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.WorldConfig;

        /**
         * Decodes a WorldConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns WorldConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.WorldConfig;

        /**
         * Verifies a WorldConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a WorldConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns WorldConfig
         */
        public static fromObject(object: { [k: string]: any }): snake.WorldConfig;

        /**
         * Creates a plain object from a WorldConfig message. Also converts values to other types if specified.
         * @param message WorldConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.WorldConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this WorldConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for WorldConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SimulationConfig. */
    interface ISimulationConfig {

        /** SimulationConfig tick_rate */
        tick_rate?: (number|null);

        /** SimulationConfig base_speed_per_second */
        base_speed_per_second?: (number|null);

        /** SimulationConfig max_turn_speed_deg_per_second */
        max_turn_speed_deg_per_second?: (number|null);

        /** SimulationConfig min_turn_radius */
        min_turn_radius?: (number|null);

        /** SimulationConfig turn_radius_thickness_coeff */
        turn_radius_thickness_coeff?: (number|null);

        /** SimulationConfig turn_idle_smoothing_at_20hz */
        turn_idle_smoothing_at_20hz?: (number|null);

        /** SimulationConfig turn_active_smoothing_at_20hz */
        turn_active_smoothing_at_20hz?: (number|null);
    }

    /** Represents a SimulationConfig. */
    class SimulationConfig implements ISimulationConfig {

        /**
         * Constructs a new SimulationConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.ISimulationConfig);

        /** SimulationConfig tick_rate. */
        public tick_rate?: (number|null);

        /** SimulationConfig base_speed_per_second. */
        public base_speed_per_second?: (number|null);

        /** SimulationConfig max_turn_speed_deg_per_second. */
        public max_turn_speed_deg_per_second?: (number|null);

        /** SimulationConfig min_turn_radius. */
        public min_turn_radius?: (number|null);

        /** SimulationConfig turn_radius_thickness_coeff. */
        public turn_radius_thickness_coeff?: (number|null);

        /** SimulationConfig turn_idle_smoothing_at_20hz. */
        public turn_idle_smoothing_at_20hz?: (number|null);

        /** SimulationConfig turn_active_smoothing_at_20hz. */
        public turn_active_smoothing_at_20hz?: (number|null);

        /**
         * Creates a new SimulationConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SimulationConfig instance
         */
        public static create(properties?: snake.ISimulationConfig): snake.SimulationConfig;

        /**
         * Encodes the specified SimulationConfig message. Does not implicitly {@link snake.SimulationConfig.verify|verify} messages.
         * @param message SimulationConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.ISimulationConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SimulationConfig message, length delimited. Does not implicitly {@link snake.SimulationConfig.verify|verify} messages.
         * @param message SimulationConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.ISimulationConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SimulationConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SimulationConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.SimulationConfig;

        /**
         * Decodes a SimulationConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SimulationConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.SimulationConfig;

        /**
         * Verifies a SimulationConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SimulationConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SimulationConfig
         */
        public static fromObject(object: { [k: string]: any }): snake.SimulationConfig;

        /**
         * Creates a plain object from a SimulationConfig message. Also converts values to other types if specified.
         * @param message SimulationConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.SimulationConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SimulationConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SimulationConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a SnakeConfig. */
    interface ISnakeConfig {

        /** SnakeConfig base_head_radius */
        base_head_radius?: (number|null);

        /** SnakeConfig score_thickness_scale */
        score_thickness_scale?: (number|null);

        /** SnakeConfig camera_zoom_out_coeff */
        camera_zoom_out_coeff?: (number|null);

        /** SnakeConfig growth_score_per_segment */
        growth_score_per_segment?: (string|null);

        /** SnakeConfig start_length */
        start_length?: (number|null);

        /** SnakeConfig start_score */
        start_score?: (number|null);

        /** SnakeConfig min_body_length */
        min_body_length?: (number|null);

        /** SnakeConfig safe_spawn_distance */
        safe_spawn_distance?: (number|null);

        /** SnakeConfig max_growth_score */
        max_growth_score?: (number|null);
    }

    /** Represents a SnakeConfig. */
    class SnakeConfig implements ISnakeConfig {

        /**
         * Constructs a new SnakeConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.ISnakeConfig);

        /** SnakeConfig base_head_radius. */
        public base_head_radius?: (number|null);

        /** SnakeConfig score_thickness_scale. */
        public score_thickness_scale?: (number|null);

        /** SnakeConfig camera_zoom_out_coeff. */
        public camera_zoom_out_coeff?: (number|null);

        /** SnakeConfig growth_score_per_segment. */
        public growth_score_per_segment?: (string|null);

        /** SnakeConfig start_length. */
        public start_length?: (number|null);

        /** SnakeConfig start_score. */
        public start_score?: (number|null);

        /** SnakeConfig min_body_length. */
        public min_body_length?: (number|null);

        /** SnakeConfig safe_spawn_distance. */
        public safe_spawn_distance?: (number|null);

        /** SnakeConfig max_growth_score. */
        public max_growth_score?: (number|null);

        /**
         * Creates a new SnakeConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns SnakeConfig instance
         */
        public static create(properties?: snake.ISnakeConfig): snake.SnakeConfig;

        /**
         * Encodes the specified SnakeConfig message. Does not implicitly {@link snake.SnakeConfig.verify|verify} messages.
         * @param message SnakeConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.ISnakeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified SnakeConfig message, length delimited. Does not implicitly {@link snake.SnakeConfig.verify|verify} messages.
         * @param message SnakeConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.ISnakeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a SnakeConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns SnakeConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.SnakeConfig;

        /**
         * Decodes a SnakeConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns SnakeConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.SnakeConfig;

        /**
         * Verifies a SnakeConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a SnakeConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns SnakeConfig
         */
        public static fromObject(object: { [k: string]: any }): snake.SnakeConfig;

        /**
         * Creates a plain object from a SnakeConfig message. Also converts values to other types if specified.
         * @param message SnakeConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.SnakeConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this SnakeConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for SnakeConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a VisualConfig. */
    interface IVisualConfig {

        /** VisualConfig min_fog_radius */
        min_fog_radius?: (number|null);

        /** VisualConfig fog_score_expansion_coeff */
        fog_score_expansion_coeff?: (number|null);

        /** VisualConfig camera_base_zoom */
        camera_base_zoom?: (number|null);

        /** VisualConfig camera_pitch_angle */
        camera_pitch_angle?: (number|null);

        /** VisualConfig camera_z_height */
        camera_z_height?: (number|null);

        /** VisualConfig camera_y_offset */
        camera_y_offset?: (number|null);

        /** VisualConfig mouse_sensitivity */
        mouse_sensitivity?: (number|null);

        /** VisualConfig head_glow_radius */
        head_glow_radius?: (number|null);
    }

    /** Represents a VisualConfig. */
    class VisualConfig implements IVisualConfig {

        /**
         * Constructs a new VisualConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IVisualConfig);

        /** VisualConfig min_fog_radius. */
        public min_fog_radius?: (number|null);

        /** VisualConfig fog_score_expansion_coeff. */
        public fog_score_expansion_coeff?: (number|null);

        /** VisualConfig camera_base_zoom. */
        public camera_base_zoom?: (number|null);

        /** VisualConfig camera_pitch_angle. */
        public camera_pitch_angle?: (number|null);

        /** VisualConfig camera_z_height. */
        public camera_z_height?: (number|null);

        /** VisualConfig camera_y_offset. */
        public camera_y_offset?: (number|null);

        /** VisualConfig mouse_sensitivity. */
        public mouse_sensitivity?: (number|null);

        /** VisualConfig head_glow_radius. */
        public head_glow_radius?: (number|null);

        /**
         * Creates a new VisualConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns VisualConfig instance
         */
        public static create(properties?: snake.IVisualConfig): snake.VisualConfig;

        /**
         * Encodes the specified VisualConfig message. Does not implicitly {@link snake.VisualConfig.verify|verify} messages.
         * @param message VisualConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IVisualConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified VisualConfig message, length delimited. Does not implicitly {@link snake.VisualConfig.verify|verify} messages.
         * @param message VisualConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IVisualConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a VisualConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns VisualConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.VisualConfig;

        /**
         * Decodes a VisualConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns VisualConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.VisualConfig;

        /**
         * Verifies a VisualConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a VisualConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns VisualConfig
         */
        public static fromObject(object: { [k: string]: any }): snake.VisualConfig;

        /**
         * Creates a plain object from a VisualConfig message. Also converts values to other types if specified.
         * @param message VisualConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.VisualConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this VisualConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for VisualConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FoodTypeConfig. */
    interface IFoodTypeConfig {

        /** FoodTypeConfig value */
        value?: (number|null);

        /** FoodTypeConfig weight */
        weight?: (number|null);

        /** FoodTypeConfig color */
        color?: (string|null);

        /** FoodTypeConfig image */
        image?: (string|null);
    }

    /** Represents a FoodTypeConfig. */
    class FoodTypeConfig implements IFoodTypeConfig {

        /**
         * Constructs a new FoodTypeConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IFoodTypeConfig);

        /** FoodTypeConfig value. */
        public value?: (number|null);

        /** FoodTypeConfig weight. */
        public weight?: (number|null);

        /** FoodTypeConfig color. */
        public color?: (string|null);

        /** FoodTypeConfig image. */
        public image?: (string|null);

        /**
         * Creates a new FoodTypeConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FoodTypeConfig instance
         */
        public static create(properties?: snake.IFoodTypeConfig): snake.FoodTypeConfig;

        /**
         * Encodes the specified FoodTypeConfig message. Does not implicitly {@link snake.FoodTypeConfig.verify|verify} messages.
         * @param message FoodTypeConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IFoodTypeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FoodTypeConfig message, length delimited. Does not implicitly {@link snake.FoodTypeConfig.verify|verify} messages.
         * @param message FoodTypeConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IFoodTypeConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FoodTypeConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FoodTypeConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.FoodTypeConfig;

        /**
         * Decodes a FoodTypeConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FoodTypeConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.FoodTypeConfig;

        /**
         * Verifies a FoodTypeConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FoodTypeConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FoodTypeConfig
         */
        public static fromObject(object: { [k: string]: any }): snake.FoodTypeConfig;

        /**
         * Creates a plain object from a FoodTypeConfig message. Also converts values to other types if specified.
         * @param message FoodTypeConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.FoodTypeConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FoodTypeConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FoodTypeConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a FoodConfig. */
    interface IFoodConfig {

        /** FoodConfig types */
        types?: (snake.IFoodTypeConfig[]|null);

        /** FoodConfig base_radius */
        base_radius?: (number|null);

        /** FoodConfig radius_value_scale */
        radius_value_scale?: (number|null);

        /** FoodConfig death_drop_score_fraction */
        death_drop_score_fraction?: (number|null);

        /** FoodConfig attraction_radius */
        attraction_radius?: (number|null);

        /** FoodConfig attraction_speed */
        attraction_speed?: (number|null);
    }

    /** Represents a FoodConfig. */
    class FoodConfig implements IFoodConfig {

        /**
         * Constructs a new FoodConfig.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IFoodConfig);

        /** FoodConfig types. */
        public types: snake.IFoodTypeConfig[];

        /** FoodConfig base_radius. */
        public base_radius?: (number|null);

        /** FoodConfig radius_value_scale. */
        public radius_value_scale?: (number|null);

        /** FoodConfig death_drop_score_fraction. */
        public death_drop_score_fraction?: (number|null);

        /** FoodConfig attraction_radius. */
        public attraction_radius?: (number|null);

        /** FoodConfig attraction_speed. */
        public attraction_speed?: (number|null);

        /**
         * Creates a new FoodConfig instance using the specified properties.
         * @param [properties] Properties to set
         * @returns FoodConfig instance
         */
        public static create(properties?: snake.IFoodConfig): snake.FoodConfig;

        /**
         * Encodes the specified FoodConfig message. Does not implicitly {@link snake.FoodConfig.verify|verify} messages.
         * @param message FoodConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IFoodConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified FoodConfig message, length delimited. Does not implicitly {@link snake.FoodConfig.verify|verify} messages.
         * @param message FoodConfig message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IFoodConfig, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a FoodConfig message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns FoodConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.FoodConfig;

        /**
         * Decodes a FoodConfig message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns FoodConfig
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.FoodConfig;

        /**
         * Verifies a FoodConfig message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a FoodConfig message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns FoodConfig
         */
        public static fromObject(object: { [k: string]: any }): snake.FoodConfig;

        /**
         * Creates a plain object from a FoodConfig message. Also converts values to other types if specified.
         * @param message FoodConfig
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.FoodConfig, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this FoodConfig to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for FoodConfig
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Food. */
    interface IFood {

        /** Food id */
        id?: (number|null);

        /** Food x */
        x?: (number|null);

        /** Food y */
        y?: (number|null);

        /** Food value */
        value?: (number|null);

        /** Food color */
        color?: (string|null);

        /** Food image */
        image?: (string|null);
    }

    /** Represents a Food. */
    class Food implements IFood {

        /**
         * Constructs a new Food.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IFood);

        /** Food id. */
        public id?: (number|null);

        /** Food x. */
        public x?: (number|null);

        /** Food y. */
        public y?: (number|null);

        /** Food value. */
        public value?: (number|null);

        /** Food color. */
        public color?: (string|null);

        /** Food image. */
        public image?: (string|null);

        /**
         * Creates a new Food instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Food instance
         */
        public static create(properties?: snake.IFood): snake.Food;

        /**
         * Encodes the specified Food message. Does not implicitly {@link snake.Food.verify|verify} messages.
         * @param message Food message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IFood, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Food message, length delimited. Does not implicitly {@link snake.Food.verify|verify} messages.
         * @param message Food message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IFood, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Food message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Food
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.Food;

        /**
         * Decodes a Food message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Food
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.Food;

        /**
         * Verifies a Food message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Food message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Food
         */
        public static fromObject(object: { [k: string]: any }): snake.Food;

        /**
         * Creates a plain object from a Food message. Also converts values to other types if specified.
         * @param message Food
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.Food, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Food to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Food
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a MovedFood. */
    interface IMovedFood {

        /** MovedFood id */
        id?: (number|null);

        /** MovedFood x */
        x?: (number|null);

        /** MovedFood y */
        y?: (number|null);
    }

    /** Represents a MovedFood. */
    class MovedFood implements IMovedFood {

        /**
         * Constructs a new MovedFood.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IMovedFood);

        /** MovedFood id. */
        public id?: (number|null);

        /** MovedFood x. */
        public x?: (number|null);

        /** MovedFood y. */
        public y?: (number|null);

        /**
         * Creates a new MovedFood instance using the specified properties.
         * @param [properties] Properties to set
         * @returns MovedFood instance
         */
        public static create(properties?: snake.IMovedFood): snake.MovedFood;

        /**
         * Encodes the specified MovedFood message. Does not implicitly {@link snake.MovedFood.verify|verify} messages.
         * @param message MovedFood message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IMovedFood, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified MovedFood message, length delimited. Does not implicitly {@link snake.MovedFood.verify|verify} messages.
         * @param message MovedFood message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IMovedFood, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a MovedFood message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns MovedFood
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.MovedFood;

        /**
         * Decodes a MovedFood message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns MovedFood
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.MovedFood;

        /**
         * Verifies a MovedFood message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a MovedFood message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns MovedFood
         */
        public static fromObject(object: { [k: string]: any }): snake.MovedFood;

        /**
         * Creates a plain object from a MovedFood message. Also converts values to other types if specified.
         * @param message MovedFood
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.MovedFood, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this MovedFood to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for MovedFood
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Portal. */
    interface IPortal {

        /** Portal id */
        id?: (string|null);

        /** Portal color */
        color?: (string|null);

        /** Portal x1 */
        x1?: (number|null);

        /** Portal y1 */
        y1?: (number|null);

        /** Portal x2 */
        x2?: (number|null);

        /** Portal y2 */
        y2?: (number|null);

        /** Portal radius */
        radius?: (number|null);

        /** Portal current_scale */
        current_scale?: (number|null);
    }

    /** Represents a Portal. */
    class Portal implements IPortal {

        /**
         * Constructs a new Portal.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IPortal);

        /** Portal id. */
        public id?: (string|null);

        /** Portal color. */
        public color?: (string|null);

        /** Portal x1. */
        public x1?: (number|null);

        /** Portal y1. */
        public y1?: (number|null);

        /** Portal x2. */
        public x2?: (number|null);

        /** Portal y2. */
        public y2?: (number|null);

        /** Portal radius. */
        public radius?: (number|null);

        /** Portal current_scale. */
        public current_scale?: (number|null);

        /**
         * Creates a new Portal instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Portal instance
         */
        public static create(properties?: snake.IPortal): snake.Portal;

        /**
         * Encodes the specified Portal message. Does not implicitly {@link snake.Portal.verify|verify} messages.
         * @param message Portal message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IPortal, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Portal message, length delimited. Does not implicitly {@link snake.Portal.verify|verify} messages.
         * @param message Portal message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IPortal, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Portal message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Portal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.Portal;

        /**
         * Decodes a Portal message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Portal
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.Portal;

        /**
         * Verifies a Portal message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Portal message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Portal
         */
        public static fromObject(object: { [k: string]: any }): snake.Portal;

        /**
         * Creates a plain object from a Portal message. Also converts values to other types if specified.
         * @param message Portal
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.Portal, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Portal to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Portal
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a BlackHole. */
    interface IBlackHole {

        /** BlackHole id */
        id?: (string|null);

        /** BlackHole x */
        x?: (number|null);

        /** BlackHole y */
        y?: (number|null);

        /** BlackHole pull_radius */
        pull_radius?: (number|null);

        /** BlackHole kill_radius */
        kill_radius?: (number|null);
    }

    /** Represents a BlackHole. */
    class BlackHole implements IBlackHole {

        /**
         * Constructs a new BlackHole.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IBlackHole);

        /** BlackHole id. */
        public id?: (string|null);

        /** BlackHole x. */
        public x?: (number|null);

        /** BlackHole y. */
        public y?: (number|null);

        /** BlackHole pull_radius. */
        public pull_radius?: (number|null);

        /** BlackHole kill_radius. */
        public kill_radius?: (number|null);

        /**
         * Creates a new BlackHole instance using the specified properties.
         * @param [properties] Properties to set
         * @returns BlackHole instance
         */
        public static create(properties?: snake.IBlackHole): snake.BlackHole;

        /**
         * Encodes the specified BlackHole message. Does not implicitly {@link snake.BlackHole.verify|verify} messages.
         * @param message BlackHole message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IBlackHole, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified BlackHole message, length delimited. Does not implicitly {@link snake.BlackHole.verify|verify} messages.
         * @param message BlackHole message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IBlackHole, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a BlackHole message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns BlackHole
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.BlackHole;

        /**
         * Decodes a BlackHole message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns BlackHole
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.BlackHole;

        /**
         * Verifies a BlackHole message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a BlackHole message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns BlackHole
         */
        public static fromObject(object: { [k: string]: any }): snake.BlackHole;

        /**
         * Creates a plain object from a BlackHole message. Also converts values to other types if specified.
         * @param message BlackHole
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.BlackHole, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this BlackHole to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for BlackHole
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Tombstone. */
    interface ITombstone {

        /** Tombstone id */
        id?: (string|null);

        /** Tombstone x */
        x?: (number|null);

        /** Tombstone y */
        y?: (number|null);

        /** Tombstone nickname */
        nickname?: (string|null);

        /** Tombstone time_left */
        time_left?: (number|null);
    }

    /** Represents a Tombstone. */
    class Tombstone implements ITombstone {

        /**
         * Constructs a new Tombstone.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.ITombstone);

        /** Tombstone id. */
        public id?: (string|null);

        /** Tombstone x. */
        public x?: (number|null);

        /** Tombstone y. */
        public y?: (number|null);

        /** Tombstone nickname. */
        public nickname?: (string|null);

        /** Tombstone time_left. */
        public time_left?: (number|null);

        /**
         * Creates a new Tombstone instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Tombstone instance
         */
        public static create(properties?: snake.ITombstone): snake.Tombstone;

        /**
         * Encodes the specified Tombstone message. Does not implicitly {@link snake.Tombstone.verify|verify} messages.
         * @param message Tombstone message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.ITombstone, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Tombstone message, length delimited. Does not implicitly {@link snake.Tombstone.verify|verify} messages.
         * @param message Tombstone message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.ITombstone, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Tombstone message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Tombstone
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.Tombstone;

        /**
         * Decodes a Tombstone message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Tombstone
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.Tombstone;

        /**
         * Verifies a Tombstone message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Tombstone message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Tombstone
         */
        public static fromObject(object: { [k: string]: any }): snake.Tombstone;

        /**
         * Creates a plain object from a Tombstone message. Also converts values to other types if specified.
         * @param message Tombstone
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.Tombstone, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Tombstone to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Tombstone
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a KillEvent. */
    interface IKillEvent {

        /** KillEvent killer */
        killer?: (string|null);

        /** KillEvent victim */
        victim?: (string|null);
    }

    /** Represents a KillEvent. */
    class KillEvent implements IKillEvent {

        /**
         * Constructs a new KillEvent.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IKillEvent);

        /** KillEvent killer. */
        public killer?: (string|null);

        /** KillEvent victim. */
        public victim?: (string|null);

        /**
         * Creates a new KillEvent instance using the specified properties.
         * @param [properties] Properties to set
         * @returns KillEvent instance
         */
        public static create(properties?: snake.IKillEvent): snake.KillEvent;

        /**
         * Encodes the specified KillEvent message. Does not implicitly {@link snake.KillEvent.verify|verify} messages.
         * @param message KillEvent message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IKillEvent, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified KillEvent message, length delimited. Does not implicitly {@link snake.KillEvent.verify|verify} messages.
         * @param message KillEvent message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IKillEvent, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a KillEvent message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns KillEvent
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.KillEvent;

        /**
         * Decodes a KillEvent message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns KillEvent
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.KillEvent;

        /**
         * Verifies a KillEvent message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a KillEvent message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns KillEvent
         */
        public static fromObject(object: { [k: string]: any }): snake.KillEvent;

        /**
         * Creates a plain object from a KillEvent message. Also converts values to other types if specified.
         * @param message KillEvent
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.KillEvent, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this KillEvent to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for KillEvent
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a Player. */
    interface IPlayer {

        /** Player angle */
        angle?: (number|null);

        /** Player score */
        score?: (number|null);

        /** Player kills */
        kills?: (number|null);

        /** Player deaths */
        deaths?: (number|null);

        /** Player accelerating */
        accelerating?: (boolean|null);

        /** Player is_dead */
        is_dead?: (boolean|null);

        /** Player teleport_state */
        teleport_state?: (string|null);

        /** Player teleport_out_x */
        teleport_out_x?: (number|null);

        /** Player teleport_out_y */
        teleport_out_y?: (number|null);

        /** Player teleport_timer_ratio */
        teleport_timer_ratio?: (number|null);

        /** Player skin */
        skin?: (string|null);

        /** Player nickname */
        nickname?: (string|null);

        /** Player body */
        body?: (number[]|null);

        /** Player new_heads */
        new_heads?: (number[]|null);

        /** Player length */
        length?: (number|null);
    }

    /** Represents a Player. */
    class Player implements IPlayer {

        /**
         * Constructs a new Player.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IPlayer);

        /** Player angle. */
        public angle?: (number|null);

        /** Player score. */
        public score?: (number|null);

        /** Player kills. */
        public kills?: (number|null);

        /** Player deaths. */
        public deaths?: (number|null);

        /** Player accelerating. */
        public accelerating?: (boolean|null);

        /** Player is_dead. */
        public is_dead?: (boolean|null);

        /** Player teleport_state. */
        public teleport_state?: (string|null);

        /** Player teleport_out_x. */
        public teleport_out_x?: (number|null);

        /** Player teleport_out_y. */
        public teleport_out_y?: (number|null);

        /** Player teleport_timer_ratio. */
        public teleport_timer_ratio?: (number|null);

        /** Player skin. */
        public skin?: (string|null);

        /** Player nickname. */
        public nickname?: (string|null);

        /** Player body. */
        public body: number[];

        /** Player new_heads. */
        public new_heads: number[];

        /** Player length. */
        public length?: (number|null);

        /**
         * Creates a new Player instance using the specified properties.
         * @param [properties] Properties to set
         * @returns Player instance
         */
        public static create(properties?: snake.IPlayer): snake.Player;

        /**
         * Encodes the specified Player message. Does not implicitly {@link snake.Player.verify|verify} messages.
         * @param message Player message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IPlayer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified Player message, length delimited. Does not implicitly {@link snake.Player.verify|verify} messages.
         * @param message Player message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IPlayer, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a Player message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns Player
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.Player;

        /**
         * Decodes a Player message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns Player
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.Player;

        /**
         * Verifies a Player message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a Player message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns Player
         */
        public static fromObject(object: { [k: string]: any }): snake.Player;

        /**
         * Creates a plain object from a Player message. Also converts values to other types if specified.
         * @param message Player
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.Player, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this Player to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for Player
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    /** Properties of a GameStateFrame. */
    interface IGameStateFrame {

        /** GameStateFrame type */
        type?: (snake.GameStateFrame.FrameType|null);

        /** GameStateFrame server_tick_rate */
        server_tick_rate?: (number|null);

        /** GameStateFrame players */
        players?: ({ [k: string]: snake.IPlayer }|null);

        /** GameStateFrame foods */
        foods?: (snake.IFood[]|null);

        /** GameStateFrame new_foods */
        new_foods?: (snake.IFood[]|null);

        /** GameStateFrame eaten_foods */
        eaten_foods?: (number[]|null);

        /** GameStateFrame moved_foods */
        moved_foods?: (snake.IMovedFood[]|null);

        /** GameStateFrame kill_events */
        kill_events?: (snake.IKillEvent[]|null);

        /** GameStateFrame tombstones */
        tombstones?: (snake.ITombstone[]|null);

        /** GameStateFrame portals */
        portals?: (snake.IPortal[]|null);

        /** GameStateFrame black_holes */
        black_holes?: (snake.IBlackHole[]|null);

        /** GameStateFrame server_world */
        server_world?: (snake.IWorldConfig|null);

        /** GameStateFrame server_simulation */
        server_simulation?: (snake.ISimulationConfig|null);

        /** GameStateFrame server_snake */
        server_snake?: (snake.ISnakeConfig|null);

        /** GameStateFrame server_visual */
        server_visual?: (snake.IVisualConfig|null);

        /** GameStateFrame server_food */
        server_food?: (snake.IFoodConfig|null);

        /** GameStateFrame your_id */
        your_id?: (string|null);

        /** GameStateFrame restart_message */
        restart_message?: (string|null);
    }

    /** Represents a GameStateFrame. */
    class GameStateFrame implements IGameStateFrame {

        /**
         * Constructs a new GameStateFrame.
         * @param [properties] Properties to set
         */
        constructor(properties?: snake.IGameStateFrame);

        /** GameStateFrame type. */
        public type?: (snake.GameStateFrame.FrameType|null);

        /** GameStateFrame server_tick_rate. */
        public server_tick_rate?: (number|null);

        /** GameStateFrame players. */
        public players: { [k: string]: snake.IPlayer };

        /** GameStateFrame foods. */
        public foods: snake.IFood[];

        /** GameStateFrame new_foods. */
        public new_foods: snake.IFood[];

        /** GameStateFrame eaten_foods. */
        public eaten_foods: number[];

        /** GameStateFrame moved_foods. */
        public moved_foods: snake.IMovedFood[];

        /** GameStateFrame kill_events. */
        public kill_events: snake.IKillEvent[];

        /** GameStateFrame tombstones. */
        public tombstones: snake.ITombstone[];

        /** GameStateFrame portals. */
        public portals: snake.IPortal[];

        /** GameStateFrame black_holes. */
        public black_holes: snake.IBlackHole[];

        /** GameStateFrame server_world. */
        public server_world?: (snake.IWorldConfig|null);

        /** GameStateFrame server_simulation. */
        public server_simulation?: (snake.ISimulationConfig|null);

        /** GameStateFrame server_snake. */
        public server_snake?: (snake.ISnakeConfig|null);

        /** GameStateFrame server_visual. */
        public server_visual?: (snake.IVisualConfig|null);

        /** GameStateFrame server_food. */
        public server_food?: (snake.IFoodConfig|null);

        /** GameStateFrame your_id. */
        public your_id?: (string|null);

        /** GameStateFrame restart_message. */
        public restart_message?: (string|null);

        /**
         * Creates a new GameStateFrame instance using the specified properties.
         * @param [properties] Properties to set
         * @returns GameStateFrame instance
         */
        public static create(properties?: snake.IGameStateFrame): snake.GameStateFrame;

        /**
         * Encodes the specified GameStateFrame message. Does not implicitly {@link snake.GameStateFrame.verify|verify} messages.
         * @param message GameStateFrame message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encode(message: snake.IGameStateFrame, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Encodes the specified GameStateFrame message, length delimited. Does not implicitly {@link snake.GameStateFrame.verify|verify} messages.
         * @param message GameStateFrame message or plain object to encode
         * @param [writer] Writer to encode to
         * @returns Writer
         */
        public static encodeDelimited(message: snake.IGameStateFrame, writer?: $protobuf.Writer): $protobuf.Writer;

        /**
         * Decodes a GameStateFrame message from the specified reader or buffer.
         * @param reader Reader or buffer to decode from
         * @param [length] Message length if known beforehand
         * @returns GameStateFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decode(reader: ($protobuf.Reader|Uint8Array), length?: number): snake.GameStateFrame;

        /**
         * Decodes a GameStateFrame message from the specified reader or buffer, length delimited.
         * @param reader Reader or buffer to decode from
         * @returns GameStateFrame
         * @throws {Error} If the payload is not a reader or valid buffer
         * @throws {$protobuf.util.ProtocolError} If required fields are missing
         */
        public static decodeDelimited(reader: ($protobuf.Reader|Uint8Array)): snake.GameStateFrame;

        /**
         * Verifies a GameStateFrame message.
         * @param message Plain object to verify
         * @returns `null` if valid, otherwise the reason why it is not
         */
        public static verify(message: { [k: string]: any }): (string|null);

        /**
         * Creates a GameStateFrame message from a plain object. Also converts values to their respective internal types.
         * @param object Plain object
         * @returns GameStateFrame
         */
        public static fromObject(object: { [k: string]: any }): snake.GameStateFrame;

        /**
         * Creates a plain object from a GameStateFrame message. Also converts values to other types if specified.
         * @param message GameStateFrame
         * @param [options] Conversion options
         * @returns Plain object
         */
        public static toObject(message: snake.GameStateFrame, options?: $protobuf.IConversionOptions): { [k: string]: any };

        /**
         * Converts this GameStateFrame to JSON.
         * @returns JSON object
         */
        public toJSON(): { [k: string]: any };

        /**
         * Gets the default type url for GameStateFrame
         * @param [typeUrlPrefix] your custom typeUrlPrefix(default "type.googleapis.com")
         * @returns The default type url
         */
        public static getTypeUrl(typeUrlPrefix?: string): string;
    }

    namespace GameStateFrame {

        /** FrameType enum. */
        enum FrameType {
            UNKNOWN = 0,
            FULL = 1,
            DELTA = 2,
            SERVER_RESTART = 3
        }
    }
}
