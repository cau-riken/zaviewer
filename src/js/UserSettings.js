class UserSettings {

    static SettingsKeys = {
        ShowAtlasRegionArea: "zav:global:atlasRegionsArea:show",
        ShowAtlasRegionBorder: "zav:global:atlasRegionsBorder:show",
        OpacityAtlasRegionArea: "zav:global:atlasRegionsArea:opacity",
    }

    static getLayerKeyPrefix(configId, layerId) {
        return `zav:${configId}:layer:${layerId}:`;
    }

    static getStrItem(key) {
        if (window.localStorage) {
            return window.localStorage.getItem(key);
        } else {
            return null;
        }
    }

    static setStrItem(key, value) {
        if (window.localStorage) {
            window.localStorage.setItem(key, value);
        }
    }

    static setBoolItem(key, value) {
        const boolValue =
            (typeof value === "boolean")
                ?
                value
                :
                (String(value) === "true")
            ;

        this.setStrItem(key, String(boolValue));
    }

    static getBoolItem(key, defaultValue) {
        const strValue = this.getStrItem(key);
        if (strValue === null) {
            return defaultValue;
        } else {
            return strValue === "true";
        }
    }

    static setNumItem(key, value) {
        const numValue =
            Number.isInteger(value)
                ?
                Number.parseInt(value)
                :
                Number.parseFloat(value)
            ;
        if (!Number.isNaN(numValue)) {
            this.setStrItem(key, String(numValue));
        }
    }

    static getNumItem(key, defaultValue) {
        const strValue = this.getStrItem(key);
        if (strValue === null) {
            return defaultValue;
        } else {
            return Number(strValue);
        }
    }
}

export default UserSettings;
