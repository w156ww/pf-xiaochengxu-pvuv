const path = require("path");

module.exports = {
	entry: "./src/index.js",
	output: {
		filename: "pvuv.min.js",
		path: path.resolve(__dirname, "dist"),
		libraryTarget: "umd",
	},
	module: {
		rules: [
			{
				test: /\.m?js$/,
				exclude: /(node_modules|bower_components)/,
				use: {
					loader: "babel-loader",
					options: {
						presets: ["@babel/preset-env"],
					},
				},
			},
		],
	},
};
