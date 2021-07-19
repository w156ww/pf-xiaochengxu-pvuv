const amapFile = require("./amap-wx.js");

class Pvuv {
	constructor(props) {
		this.key = props.mapKey;
		this.systemId = props.systemId;
		this.url = props.url;
	}

	#STORAGE_KEY = {
		_PVUV_AMAP_INFO_KEY: "_PVUV_AMAP_INFO_KEY",
	};
	#amap = null;

	#generatorUUID(len, radix) {
		var chars =
			"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split(
				""
			);
		var uuid = [],
			i;
		radix = radix || chars.length;

		if (len) {
			for (i = 0; i < len; i++) uuid[i] = chars[0 | (Math.random() * radix)];
		} else {
			var r;
			uuid[8] = uuid[13] = uuid[18] = uuid[23] = "-";
			uuid[14] = "4";

			for (i = 0; i < 36; i++) {
				if (!uuid[i]) {
					r = 0 | (Math.random() * 16);
					uuid[i] = chars[i == 19 ? (r & 0x3) | 0x8 : r];
				}
			}
		}

		return uuid.join("");
	}

	#setAndGetPvuvStorage() {
		var uuid = this.#generatorUUID(16, 16);
		try {
			var id = wx.getStorageSync("_PVUV_MACHINE_ID");
			if (id) {
				return id;
			}
			wx.setStorageSync("_PVUV_MACHINE_ID", uuid);
		} catch (e) {
			console.log("pvuv error: ", e);
		}

		return uuid;
	}

	#send_monitor_pvuv(_maq_baseinfo_monitor) {
		const params = {};
		const filterKeys = [
			"monitorPoint",
			"userId",
			"systemId",
			"pvuvMachineId",
			"expire_t",
			"t"
		];
		Object.keys(_maq_baseinfo_monitor).forEach((key) => {
			if (!filterKeys.includes(key)) {
				params[`param_${key}`] =
					typeof _maq_baseinfo_monitor[key] === "object"
						? JSON.stringify(_maq_baseinfo_monitor[key])
						: _maq_baseinfo_monitor[key];
			} else {
				params[key] = _maq_baseinfo_monitor[key];
			}
		});
		wx.request({
			url: this.url,
			method: "get",
			data: params,
			success(res) {
				console.log("pvuv request success: ", res);
			},
			fail(e) {
				console.log("pvuv request fail: ", e);
			},
		});
	}

	sendLogMonitor_pvuv(monitorpoint, _userid, _parammap) {
		if (monitorpoint !== 0 && !monitorpoint) return;

		const params = _parammap ?? {};
		this.#getLocationInfo(params)
			.then((res) => {
				this.#merge_monitor_data(monitorpoint, _userid, res);
			})
			.catch((e) => {
				this.#merge_monitor_data(monitorpoint, _userid, params);
			});
	}

	#merge_monitor_data(monitorpoint, _userid, _parammap) {
		const _pvuvMachineId = this.#setAndGetPvuvStorage();
		const _maq_baseinfo_monitor = {
			monitorPoint: monitorpoint,
			userId: _userid,
			systemId: this.systemId,
			pvuvMachineId: _pvuvMachineId,
			t: +new Date(),
			..._parammap,
		};

		this.#send_monitor_pvuv(_maq_baseinfo_monitor);
	}

	#getStorageData(key) {
		return wx.getStorageSync(key);
	}

	#setStorageData(key, value) {
		wx.setStorageSync(key, value);
	}

	#getLocationInfo(_parammap) {
		let areaInfo = null;
		let flag = true;
		const { _PVUV_AMAP_INFO_KEY } = this.#STORAGE_KEY;
		areaInfo = this.#getStorageData(_PVUV_AMAP_INFO_KEY);
		if (areaInfo) {
			const expire_t = areaInfo.expire_t;
			if (+new Date() < expire_t) {
				flag = false;
			}
		}
		if (!this.#amap) {
			this.#amap = new amapFile.AMapWX({
				key: this.key,
			});
		}
		return new Promise((resolve, reject) => {
			if (flag) {
				this.#amap.getRegeo({
					success: (data) => {
						const positionInfo = data[0];
						const { regeocodeData, ...rest } = positionInfo;
						areaInfo = {
							...rest,
							...regeocodeData.addressComponent,
							expire_t: +new Date(new Date() * 1 + 2 * 60 * 60 * 1000), // 2 小时有效期
						};
						const params = {
							..._parammap,
							...areaInfo,
						};
						this.#setStorageData(_PVUV_AMAP_INFO_KEY, areaInfo);
						resolve(params);
					},
					fail: (info) => {
						Object.assign(_parammap, {
							location_fail: true,
						});
						reject(_parammap);
					},
				});
			} else {
				const params = {
					..._parammap,
					...areaInfo,
				};
				resolve(params);
			}
		});
	}
}
module.exports = Pvuv;
module.exports.default = Pvuv;
