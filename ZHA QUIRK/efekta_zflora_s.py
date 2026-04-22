# zflora_s.py
# Quirk for zFlora_S (Plant watering sensor)
from typing import Final
from enum import IntEnum

from zigpy.profiles import zha
from zigpy.quirks import CustomCluster
from zigpy.quirks.v2 import (
    QuirkBuilder,
    SensorDeviceClass,
    SensorStateClass,
    EntityType,
    EntityPlatform,
)
from zigpy.quirks.v2.homeassistant.number import NumberDeviceClass
import zigpy.types as t
from zigpy.zcl.foundation import ZCLAttributeDef
from zigpy.zcl.clusters.general import Basic, PowerConfiguration, Time
from zigpy.zcl.clusters.measurement import (
    TemperatureMeasurement,
    RelativeHumidity,
    SoilMoisture,
)
from zigpy.quirks.v2.homeassistant import (
    UnitOfTime,
    UnitOfTemperature,
    PERCENTAGE,
)

EFEKTA = "EfektaLab"

class TxRadioPowerEnum(IntEnum):
    ZERO = 0
    PLUS_4 = 4


class PowerCfg(PowerConfiguration, CustomCluster):
    class AttributeDefs(PowerConfiguration.AttributeDefs):
        read_sensors_delay: Final = ZCLAttributeDef(id=0x0201, type=t.uint16_t, access="rw")
        smart_sleep: Final = ZCLAttributeDef(id=0x0216, type=t.Bool, access="rw")
        tx_radio_power: Final = ZCLAttributeDef(id=0x0236, type=t.int8s, access="rw")


class SoilMoistureCfg(SoilMoisture, CustomCluster):
    class AttributeDefs(SoilMoisture.AttributeDefs):
        lower_level: Final = ZCLAttributeDef(id=0x0502, type=t.uint16_t, access="rw")
        upper_level: Final = ZCLAttributeDef(id=0x0503, type=t.uint16_t, access="rw")


class TempMeasurement(TemperatureMeasurement, CustomCluster):
    class AttributeDefs(TemperatureMeasurement.AttributeDefs):
        temperature_offset: Final = ZCLAttributeDef(id=0x0410, type=t.int16s, access="rw")
        temperature_compensation: Final = ZCLAttributeDef(id=0x0504, type=t.Bool, access="rw")


class TimeExt(Time, CustomCluster):
    class AttributeDefs(Time.AttributeDefs):
        uptime: Final = ZCLAttributeDef(id=0x0006, type=t.uint32_t, access="r")


(
    QuirkBuilder(EFEKTA, "zFlora_S")
    .replaces_endpoint(1, device_type=zha.DeviceType.SIMPLE_SENSOR)
    .replaces(Basic, endpoint_id=1)
    .replaces(PowerCfg, endpoint_id=1)
    .replaces(TimeExt, endpoint_id=1)
    .replaces(TempMeasurement, endpoint_id=1)
    .replaces(RelativeHumidity, endpoint_id=1)
    .replaces(SoilMoistureCfg, endpoint_id=1)
    
    # ============== UPTIME SENSOR ==============
    
    .sensor(
        TimeExt.AttributeDefs.uptime.name,
        TimeExt.cluster_id,
        endpoint_id=1,
        state_class=SensorStateClass.MEASUREMENT,
        device_class=SensorDeviceClass.DURATION,
        unit=UnitOfTime.HOURS,
        translation_key="uptime",
        fallback_name="Uptime",
        divisor=3600,
    )
    
    # ============== CONFIGURATION ==============
    
    .number(
        PowerCfg.AttributeDefs.read_sensors_delay.name,
        PowerCfg.cluster_id,
        endpoint_id=1,
        translation_key="read_sensors_delay",
        fallback_name="Setting the time in minutes",
        unique_id_suffix="read_sensors_delay",
        min_value=1,
        max_value=360,
        step=1,
        device_class=NumberDeviceClass.DURATION,
        unit=UnitOfTime.MINUTES,
    )
    .enum(
        PowerCfg.AttributeDefs.tx_radio_power.name,
        TxRadioPowerEnum,
        PowerCfg.cluster_id,
        endpoint_id=1,
        translation_key="tx_radio_power",
        fallback_name="Set TX Radio Power",
        unique_id_suffix="tx_radio_power",
        entity_type=EntityType.CONFIG,
        entity_platform=EntityPlatform.SELECT,
    )
    .switch(
        PowerCfg.AttributeDefs.smart_sleep.name,
        PowerCfg.cluster_id,
        endpoint_id=1,
        translation_key="smart_sleep",
        fallback_name="Smart sleep",
        unique_id_suffix="smart_sleep",
    )
    .number(
        SoilMoistureCfg.AttributeDefs.lower_level.name,
        SoilMoistureCfg.cluster_id,
        endpoint_id=1,
        translation_key="lower_level",
        fallback_name="The lower level of soil moisture 0% is",
        unique_id_suffix="lower_level",
        min_value=0,
        max_value=99,
        step=1,
        unit=PERCENTAGE,
    )
    .number(
        SoilMoistureCfg.AttributeDefs.upper_level.name,
        SoilMoistureCfg.cluster_id,
        endpoint_id=1,
        translation_key="upper_level",
        fallback_name="The upper level of soil moisture 100% is",
        unique_id_suffix="upper_level",
        min_value=1,
        max_value=100,
        step=1,
        unit=PERCENTAGE,
    )
    .number(
        TempMeasurement.AttributeDefs.temperature_offset.name,
        TempMeasurement.cluster_id,
        endpoint_id=1,
        translation_key="temperature_offset",
        fallback_name="Adjust temperature",
        unique_id_suffix="temperature_offset",
        min_value=-50,
        max_value=50,
        step=0.1,
        multiplier=0.1,
        device_class=NumberDeviceClass.TEMPERATURE,
        unit=UnitOfTemperature.CELSIUS,
        mode="box",
    )
    .switch(
        TempMeasurement.AttributeDefs.temperature_compensation.name,
        TempMeasurement.cluster_id,
        endpoint_id=1,
        translation_key="temperature_compensation",
        fallback_name="Temperature compensation",
        unique_id_suffix="temperature_compensation",
    )
    
    .add_to_registry()
)