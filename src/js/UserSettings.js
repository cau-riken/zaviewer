class UserSettings {

    static SettingsKeys = {
        ShowAtlasRegionArea: "zav:global:atlasRegionsArea:show",
        ShowAtlasRegionBorder: "zav:global:atlasRegionsBorder:show",
        ShowAtlasRegionLabel: "zav:global:atlasRegionsLabel:show",
        ShowOverlayROI: "zav:global:overlayROI:show",
        OpacityAtlasRegionArea: "zav:global:atlasRegionsArea:opacity",
        UseCustomRegionBorder: "zav:global:atlasRegionsCustomBorder:use",
        CustomRegionBorderColor: "zav:global:atlasRegionsCustomBorder:color",
        CustomRegionBorderWidth: "zav:global:atlasRegionsCustomBorder:width",
    }

    static getLayerKeyPrefix(configId, layerId) {
        return `zav:${configId}:layer:${layerId}:`;
    }

    static getStrItem(key, defaultValue) {
        if (window.localStorage) {
            const value = window.localStorage.getItem(key);
            if (value === null && typeof defaultValue != 'undefined') {
                return defaultValue;
            } else {
                return value;
            }
        } else {
            return null;
        }
    }

    static setStrItem(key, value) {
        if (window.localStorage && typeof value != 'undefined') {
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
