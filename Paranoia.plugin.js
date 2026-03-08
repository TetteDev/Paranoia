/**
 * @name Paranoia
 * @author TetteDev
 * @description A maintained/updated version of the now abandoned DoNotTrack plugin by Zerebos. This plugin will attempt to block as much tracking as possible.
 * @version 0.0.2
 * @source https://github.com/TetteDev/Paranoia
 */

module.exports = class Paranoia {
    #pluginID = null;
    #trackingCache = null;
    #defaultSettings = null;

    constructor(meta) {
        this.#pluginID = meta.name;
        this.#trackingCache = new Map();

        this.#defaultSettings = {
            verboseMode: false, // be bombarded with logs

            cacheMaxSize: 256, // -1 for unbounded, or set a positive integer for max cache size

            featureToggles: {
                network: {
                    enabled: true,
                    fetch: true,
                    fetchLater: true,
                    XMLHttpRequest: true,
                    sendBeacon: true,
                },
                sentry: {
                    enabled: true,
                },
                misc: {
                    enabled: true,

                    webpackAnalyticsModule: true,
                    webpackNativeModule: true,

                    linkCleaner: false,
                }
            }
        };

        this.settings = this.loadSettings();
        
        this.verboseMode = this.settings.verboseMode;
        this.featureToggles = this.settings.featureToggles;
        this.cacheMaxSize = this.settings.cacheMaxSize;
    }

    loadSettings() {
        const saved = BdApi.Data.load(this.#pluginID, "settings");
        if (saved) {
            return {
                ...this.#defaultSettings,
                ...saved,
                featureToggles: {
                    network: { ...this.#defaultSettings.featureToggles.network, ...saved.featureToggles?.network },
                    sentry: { ...this.#defaultSettings.featureToggles.sentry, ...saved.featureToggles?.sentry },
                    misc: { ...this.#defaultSettings.featureToggles.misc, ...saved.featureToggles?.misc }
                }
            };
        }
        return this.#defaultSettings;
    }
    saveSettings() {
        BdApi.Data.save(this.#pluginID, "settings", this.settings);
        this.verboseMode = this.settings.verboseMode;
        this.featureToggles = this.settings.featureToggles;
    }
    getSettingsPanel() {
        const settings = [
            {
                type: "switch",
                id: "verboseMode",
                name: "Verbose Logging",
                note: "Enable very detailed logging to the console for debugging purposes.",
                value: this.settings.verboseMode
            },
            {
                type: "number",
                id: "cacheMaxSize",
                name: "Tracking URL Cache Max Size",
                note: "Set a maximum size for the tracking URL cache to prevent unbounded memory growth. Set to -1 for unlimited cache size.",
                value: this.settings.cacheMaxSize,
                min: -1,
                step: 1,
            },
            {
                type: "category",
                id: "network",
                name: "Network Request Blocking",
                collapsible: true,
                shown: true,
                settings: [
                    {
                        type: "switch",
                        id: "network.enabled",
                        name: "Enable Network Blocking",
                        note: "Master toggle for all network request blocking. Disabling this will ignore all individual toggles below.",
                        value: this.settings.featureToggles.network.enabled
                    },
                    {
                        type: "switch",
                        id: "network.fetch",
                        name: "Block fetch() Requests",
                        note: "Intercept and block tracking requests made via the fetch() API.",
                        value: this.settings.featureToggles.network.fetch
                    },
                    {
                        type: "switch",
                        id: "network.fetchLater",
                        name: "Block fetchLater() Requests",
                        note: "Intercept and block tracking requests made via the fetchLater() API (if available).",
                        value: this.settings.featureToggles.network.fetchLater
                    },
                    {
                        type: "switch",
                        id: "network.XMLHttpRequest",
                        name: "Block XMLHttpRequest",
                        note: "Intercept and block tracking requests made via XMLHttpRequest (XHR).",
                        value: this.settings.featureToggles.network.XMLHttpRequest
                    },
                    {
                        type: "switch",
                        id: "network.sendBeacon",
                        name: "Block sendBeacon() Requests",
                        note: "Intercept and block tracking requests made via navigator.sendBeacon().",
                        value: this.settings.featureToggles.network.sendBeacon
                    }
                ]
            },
            {
                type: "category",
                id: "sentry",
                name: "Sentry Error Tracking",
                collapsible: true,
                shown: true,
                settings: [
                    {
                        type: "switch",
                        id: "sentry.enabled",
                        name: "Disable Sentry",
                        note: "Disable Discord's Sentry error tracking and reporting system. Note: Changes require a Discord restart to fully take effect.",
                        value: this.settings.featureToggles.sentry.enabled
                    }
                ]
            },
            {
                type: "category",
                id: "misc",
                name: "Miscellaneous Blocking",
                collapsible: true,
                shown: true,
                settings: [
                    {
                        type: "switch",
                        id: "misc.enabled",
                        name: "Enable Miscellaneous Blocking",
                        note: "Master toggle for miscellaneous blocking features. Disabling this will ignore all individual toggles below.",
                        value: this.settings.featureToggles.misc.enabled
                    },
                    {
                        type: "switch",
                        id: "misc.webpackAnalyticsModule",
                        name: "Block Webpack Analytics Module",
                        note: "Disable Discord's internal analytics tracking module loaded from Webpack.",
                        value: this.settings.featureToggles.misc.webpackAnalyticsModule
                    },
                    {
                        type: "switch",
                        id: "misc.webpackNativeModule",
                        name: "Block Native Module Tracking",
                        note: "Prevent Discord from loading native modules related to tracking.",
                        value: this.settings.featureToggles.misc.webpackNativeModule
                    },
                    {
                        type: "switch",
                        id: "misc.linkCleaner",
                        name: "Enable Link Cleaner",
                        note: "Enable the link cleaner feature to remove tracking parameters from URLs.",
                        value: this.settings.featureToggles.misc.linkCleaner
                    }
                ]
            }
        ];

        return BdApi.UI.buildSettingsPanel({
            settings: settings,
            onChange: (category, id, value) => {
                if (category) {
                    const [catName, settingName] = id.split('.');
                    if (settingName) {
                        this.settings.featureToggles[catName][settingName] = value;
                        this.verboseLog(`Updated setting: ${catName}.${settingName} = ${value}`);
                    }
                } else {
                    this.settings[id] = value;
                    this.verboseLog(`Updated setting: ${id} = ${value}`);
                }
                
                this.saveSettings();
                
                BdApi.Logger.info(this.#pluginID, `Setting changed: ${category ? category + '.' : ''}${id} = ${value}`);
                
                // TODO: any sentry related changes probably dont need a restart, but why the hell not
                // if (id === "sentry.enabled") {
                //     BdApi.UI.showToast("Sentry changes require a Discord restart to fully take effect.", { type: "warning", timeout: 5000 });
                // } else {
                //     BdApi.UI.showToast("Settings saved! Please reload the plugin or restart Discord for changes to take effect.", { type: "info", timeout: 3000 });
                // }
            }
        });
    }

    start() {
        BdApi.Logger.info(this.#pluginID, 'Started Plugin');

        this.overrideNetworking();
        this.overrideSentry();
        this.overrideMisc();
    }
    stop() {
        BdApi.Patcher.unpatchAll(this.#pluginID);
        this.#trackingCache.clear();

        BdApi.Logger.info(this.#pluginID, `Stopped Plugin`);
    }

    overrideNetworking() {
        if (!this.featureToggles.network.enabled) {
            this.verboseLog("Network blocking is disabled via feature toggles, skipping network overrides");
            return;
        }

        // NOTE: handle fetch
        if (this.featureToggles.network.fetch === true) {
            BdApi.Patcher.instead(this.#pluginID, window, "fetch", (thisObject, args, originalFunction) => {
                try {
                    const [url, options] = args;
                    const urlString = this.normalizeURL(url);
                    this.verboseLog(`fetch called with URL: ${urlString}`);

                    const isTracking = this.isTrackingRequest(urlString);
                    if (isTracking) {
                        BdApi.Logger.warn(this.#pluginID, `Blocked fetch: ${urlString}`);
                        return Promise.reject(new Error("Blocked tracking request"));
                    }
                    else {
                        this.verboseLog(`Allowed fetch: ${urlString}`);
                        return originalFunction.apply(thisObject, args);
                    }
                } catch (error) {
                    BdApi.Logger.error(this.#pluginID, "Error in fetch patch:", error);
                    return originalFunction.apply(thisObject, args);
                }
            });
            this.verboseLog("Fetch patch applied");
        }

        // NOTE: handle fetchLater
        if (this.featureToggles.network.fetchLater === true && typeof window.fetchLater === 'function') {
            BdApi.Patcher.instead(this.#pluginID, window, "fetchLater", (thisObject, args, originalFunction) => {
                try {
                    const [url, options] = args;
                    const urlString = this.normalizeURL(url);
                    this.verboseLog(`fetchLater called with URL: ${urlString}`);

                    const isTracking = this.isTrackingRequest(urlString);
                    if (isTracking) {
                        BdApi.Logger.warn(this.#pluginID, `Blocked fetchLater: ${urlString}`);
                        return Promise.reject(new Error("Blocked tracking request"));
                    }
                    else {
                        this.verboseLog(`Allowed fetchLater: ${urlString}`);
                        return originalFunction.apply(thisObject, args);
                    }
                } catch (error) {
                    BdApi.Logger.error(this.#pluginID, "Error in fetchLater patch:", error);
                    return originalFunction.apply(thisObject, args);
                }
            });
            this.verboseLog("FetchLater patch applied");
        }

        // NOTE: handle XMLHttpRequest
        if (this.featureToggles.network.XMLHttpRequest === true) {
            // DEBUG: if i recall correctly, discord also uses custom "tracking" headers for their request
            // those should probably also be checked for 

            // XMLHttpRequest.open - Mark blocked requests
            BdApi.Patcher.before(this.#pluginID, XMLHttpRequest.prototype, "open", (thisObject, args) => {
                try {
                    const [method, url] = args;
                    const urlString = this.normalizeURL(url);
                    this.verboseLog(`XHR open called with URL: ${urlString}`);

                    const isTracking = this.isTrackingRequest(urlString);
                    if (isTracking) {
                        thisObject.__schizophreniaBlocked = true;
                        thisObject.__schizophreniaURL = urlString;
                        thisObject.__schizophreniaMethod = method;
                        BdApi.Logger.warn(this.#pluginID, `Marked XHR for blocking: ${method} ${urlString}`);
                    }
                    else {
                        this.verboseLog(`Allowed XHR: ${method} ${urlString}`);
                    }
                } catch (error) {
                    BdApi.Logger.error(this.#pluginID, "Error in XHR open patch:", error);
                }
            });
            this.verboseLog("XHR open patch applied");

            // XMLHttpRequest.send - Block marked requests
            BdApi.Patcher.instead(this.#pluginID, XMLHttpRequest.prototype, "send", (thisObject, args, originalFunction) => {
                try {
                    if (thisObject.__schizophreniaBlocked) {
                        BdApi.Logger.warn(this.#pluginID, `Blocked XHR: ${thisObject.__schizophreniaMethod} ${thisObject.__schizophreniaURL}`);
                        
                        // Simulate network error
                        setTimeout(() => {
                            const errorEvent = new ProgressEvent('error');
                            thisObject.dispatchEvent(errorEvent);
                        }, 16);

                        return; // Don't send
                    }
                    else {
                        return originalFunction.apply(thisObject, args);
                    }
                } catch (error) {
                    BdApi.Logger.error(this.#pluginID, "Error in XHR send patch:", error);
                    return originalFunction.apply(thisObject, args);
                }
            });
            this.verboseLog("XHR send patch applied");
        }
        
        // NOTE: handle SendBeacon
        if (this.featureToggles.network.sendBeacon === true) {
            BdApi.Patcher.instead(this.#pluginID, Navigator.prototype, "sendBeacon", (thisObject, args, originalFunction) => {
                try {
                    const [url, data] = args;
                    const urlString = this.normalizeURL(url);
                    this.verboseLog(`sendBeacon called with URL: ${urlString}`);
                    
                    if (this.isTrackingRequest(urlString)) {
                        BdApi.Logger.warn(this.#pluginID, `Blocked sendBeacon: ${urlString}`);
                        return false;
                    }
                    
                    return originalFunction.apply(thisObject, args);
                } catch (error) {
                    BdApi.Logger.error(this.#pluginID, "Error in sendBeacon patch:", error);
                    return originalFunction.apply(thisObject, args);
                }
            });
            this.verboseLog("sendBeacon patch applied");
        }
    }
    overrideSentry() { 
        if (!this.featureToggles.sentry.enabled) {
            this.verboseLog("Sentry blocking is disabled via feature toggles, skipping Sentry overrides");
            return;
        }

        const baseSentryInstance = window?.__SENTRY__;
        const sentryInstance = baseSentryInstance && Object.hasOwn(baseSentryInstance, 'version') ? baseSentryInstance[baseSentryInstance.version] : null;
        if (sentryInstance && Object.hasOwn(sentryInstance, 'logger')) {
            const sentryLogger = sentryInstance.logger;

            if ('disable' in sentryLogger) {
                sentryLogger.disable();
            }

            if ('enable' in sentryLogger) {
                const oEnable = sentryLogger.enable;
                sentryLogger.enable = function() {};
                sentryLogger.enable.toString = function() { return oEnable.toString(); };
            }

            // NOTE: Make their logger use the original console methods instead
            for (const method of Object.keys(sentryLogger)) {
                const isLoggingFunction = method in console;
                if (isLoggingFunction) {
                    const oMethod = sentryLogger[method];
                    sentryLogger[method] = console[method];
                    sentryLogger[method].toString = function() { return oMethod.toString(); };
                }
            }
        }

        // NOTE: Legacy code, they no longer store original references like this, but we restore them just in case
        for (const method in console) {
            if (!Object.hasOwn(console[method], "__sentry_original__")) continue;
            console[method] = console[method].__sentry_original__;
        }

        if (sentryInstance && Object.hasOwn(sentryInstance, 'globalScope')) {
            const sentryGlobalEventProcessors = sentryInstance.globalScope?._eventProcessors;
            if (Array.isArray(sentryGlobalEventProcessors)) {
                sentryGlobalEventProcessors.splice(0, sentryGlobalEventProcessors.length);
            }
        }

        const sentryHub = window.DiscordSentry?.getCurrentHub?.();
        if (sentryHub) {
            sentryHub.getClient()?.close?.(0);
            const scope = sentryHub.getScope();
            scope?.clear?.();
            scope?.setFingerprint?.(null);
            sentryHub?.setUser(null);
            sentryHub?.setTags({});
            sentryHub?.setExtras({});
            sentryHub?.endSession();
        }

        this.verboseLog("Sentry patch applied");
    }
    overrideMisc() {
        if (!this.featureToggles.misc.enabled) {
            this.verboseLog("Misc blocking is disabled via feature toggles, skipping misc overrides");
            return;
        }

        if (this.featureToggles.misc.webpackAnalyticsModule === true) {
            // TODO: the entire analytics module deserves a closer look, there may be more tracking related stuff that need to be blocked beyond just the "track" function

            const Analytics = BdApi.Webpack.getByKeys("AnalyticEventConfigs");
            if (Analytics?.default?.track) {
                BdApi.Patcher.instead(this.#pluginID, Analytics.default, "track", (thisObject, args, originalFunction) => {
                    BdApi.Logger.warn(this.#pluginID, "Blocked Analytics.track call with arguments:", args);
                });
                this.verboseLog("Webpack Analytics Module patch applied");
            } else {
                this.verboseLog("Analytics module not found or has invalid structure");
            }
        }

        if (this.featureToggles.misc.webpackNativeModule === true) {
            const NativeModule = BdApi.Webpack.getByKeys("getDiscordUtils");

            if (NativeModule?.ensureModule) {
                BdApi.Patcher.instead(this.#pluginID, NativeModule, "ensureModule", (thisObject, args, originalFunction) => {
                    const [moduleName] = args;
                    if (moduleName?.includes("discord_rpc")) {
                        BdApi.Logger.warn(this.#pluginID, `Blocked loading of native module: ${moduleName}`);
                        return;
                    }
                    return originalFunction.apply(thisObject, args);
                });
                this.verboseLog("Webpack Native Module patch applied");
            } else {
                this.verboseLog("Native module not found or has invalid structure");
            }

            // DEBUG: anything below here is just a safety net
            const noopedFunctions = ['submitLiveCrashReport'];
            for (const func of noopedFunctions) {
                if (NativeModule?.[func]) {
                    BdApi.Patcher.instead(this.#pluginID, NativeModule, func, (thisObject, args, originalFunction) => { BdApi.Logger.warn(this.#pluginID, `Blocked call to ${func} with arguments:`, args); });
                    this.verboseLog(`${func} patch applied`);
                }
            }

            // TODO: there is functions that contain the word "ML" (perhaps for machinelearning?)
            // investigate those further
        }

        this.__linkCleaner();
    }
    // TODO: unimplemented
    __linkCleaner() {
        if (!this.featureToggles.misc.linkCleaner) {
            this.verboseLog("Link cleaner is disabled via feature toggles, skipping link cleaner override");
            return;
        }

        // TODO: implement link cleaning here
        // performance will be very important here as this will likely be called on every single link in the app, so we need to make sure it's as efficient as possible

        this.verboseLog("Link cleaning enabled");
    }

    verboseLog(...args) {
        // NOTE: should we override this function with a no-op if verbose mode is disabled?

        if (this.verboseMode) {
            BdApi.Logger.info(this.#pluginID, ...args);
        }
        // else {
        //     // TODO: one issue with overriding this with a no-op is that we cannot "undo" this as easily
        //     // if the user enables verbose mode again
        //     // his.verboseLog = function(...args) {};
        // }
    }
    normalizeURL(url) {
        if (typeof url === 'string') return url;
        if (url instanceof URL) return url.href;
        if (url instanceof Request) return url.url;
        return String(url);
    }

    // TODO:: can we expose this as a setting for the user to, via the config window add more identifiers to block?
    #trackingIdentifiers = [
        // NOTE: so far we only block discord own tracking endpoints
        /\/api\/v\d+\/(science|metrics|track)(\/v\d+)?/,

        // DEBUG: are these even used?
        //'googletagmanager.com',
        //'cloudflareinsights.com'
    ];
    getCacheKey(url) {
        try {
            // NOTE: using a more generic cache key that ignores parameters/fragments to decrease cache misses
            const urlObj = new URL(url);
            return `${urlObj.origin}${urlObj.pathname}`;
        } catch {
            BdApi.Logger.warn(this.#pluginID, `Failed to parse URL for caching: ${url}. Using raw URL as cache key.`);
            return url;
        }
    }
    isTrackingRequest(url) {
        const cacheKey = this.getCacheKey(url);

        if (this.#trackingCache.has(cacheKey)) {
            this.verboseLog(`Cache hit for URL: ${url} - isTracking: ${this.#trackingCache.get(cacheKey)}`);
            return this.#trackingCache.get(cacheKey);
        }

        const isMatch = this.#trackingIdentifiers.some(identifier => {
            if (typeof identifier === 'string') {
                return url.includes(identifier);
            }
            if (identifier instanceof RegExp) {
                return identifier.test(url);
            }
            return false;
        });

        this.verboseLog(`Cache miss for URL: ${url} - caching isTracking result '${isMatch}' to generic key: ${cacheKey}`);
        this.#trackingCache.set(cacheKey, isMatch);
        if (this.cacheMaxSize > 0) {
            if (this.#trackingCache.size > this.cacheMaxSize) {
                // Simple cache eviction: clear the entire cache when max size is exceeded
                this.verboseLog(`Cache size exceeded max of ${this.cacheMaxSize}. Clearing cache.`);
                this.#trackingCache.clear();
            }
        }
        return isMatch;
    }
};
