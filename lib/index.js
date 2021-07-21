const amapFile = require("./amap-wx.js");

class Pvuv {
	// 存储的 key
	#STORAGE_KEY = {
		_PVUV_AMAP_INFO_KEY: "_PVUV_AMAP_INFO_KEY",
		_PVUV_MACHINE_ID: "_PVUV_MACHINE_ID",
	};
	// 地图实例
	#amap = null;
	#url = "";
	#systemId = "";
	#key = "";
	constructor(props) {
		this.#key = props.mapKey;
		this.#systemId = props.systemId;
		this.#url = props.url;
	}
	// 设置 systemid
	setSystemId(value) {
		this.#systemId = value;
	}
	// 暴露的 API 方法，用于外部主动调用，发送埋点信息
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
	// 获取路由栈信息
	#getRouteInfo() {
		try {
			const pages = getCurrentPages() || [];
			const len = pages.length;
			if (len > 0) {
				return {
					url: pages[len - 1].route,
					referer: len > 1 ? pages[len - 2].route : "",
				};
			}
			return {};
		} catch (e) {
			console.log("error: ", e);
		}
	}
	// 获取 uuid
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
	// 获取/设置唯一机器id
	#setAndGetPvuvStorage() {
		var uuid = this.#generatorUUID(16, 16);
		try {
			var id = this.#getStorageData(this.#STORAGE_KEY._PVUV_MACHINE_ID);
			if (id) {
				return id;
			}
			this.#setStorageData(this.#STORAGE_KEY._PVUV_MACHINE_ID, uuid);
		} catch (e) {
			console.log("pvuv error: ", e);
		}

		return uuid;
	}
	// 发送埋点信息，格式化最终参数
	#send_monitor_pvuv(_maq_baseinfo_monitor) {
		const params = {};
		const routeInfo = this.#getRouteInfo() || {};
		const mergeParams = { ..._maq_baseinfo_monitor, ...routeInfo };
		// 不需要添加 param_ 前缀的参数
		const filterKeys = [
			"monitorPoint",
			"userId",
			"systemId",
			"pvuvMachineId",
			"expire_t",
			"t",
			"url",
			"referer",
		];
		// 字段转换，大数据收集对应的数据，需要将高德地图返回的数据字段名称转换为规定的名称
		const dict = {
			name: "formattedAddress",
			latitude: "lat",
			longitude: "lng",
		};
		Object.keys(mergeParams).forEach((key) => {
			if (filterKeys.includes(key)) {
				params[key] = mergeParams[key];
			} else {
				params[`param_${dict[key] || key}`] =
					typeof mergeParams[key] === "object"
						? JSON.stringify(mergeParams[key])
						: mergeParams[key];
			}
		});
		wx.request({
			url: this.#url,
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
	// 合并数据，添加埋点时的时间
	#merge_monitor_data(monitorpoint, _userid, _parammap) {
		const _pvuvMachineId = this.#setAndGetPvuvStorage();
		const _maq_baseinfo_monitor = {
			monitorPoint: monitorpoint,
			userId: _userid,
			systemId: this.#systemId,
			pvuvMachineId: _pvuvMachineId,
			t: +new Date(),
			..._parammap,
		};

		this.#send_monitor_pvuv(_maq_baseinfo_monitor);
	}
	// 获取 storage
	#getStorageData(key) {
		return wx.getStorageSync(key);
	}
	// 设置 storage
	#setStorageData(key, value) {
		wx.setStorageSync(key, value);
	}
	// 获取地理位置
	#getLocationInfo(_parammap) {
		let areaInfo = null;
		let flag = true;
		const { _PVUV_AMAP_INFO_KEY } = this.#STORAGE_KEY;
		areaInfo = this.#getStorageData(_PVUV_AMAP_INFO_KEY);
		if (areaInfo) {
			const { expire_t } = areaInfo;
			if (+new Date() < expire_t) {
				flag = false;
			}
		}
		if (!this.#amap) {
			this.#amap = new amapFile.AMapWX({
				key: this.#key,
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
						reject({
							..._parammap,
							...{
								location_fail: true,
								message: info,
							},
						});
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
