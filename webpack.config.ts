import path from "path";
import type { Configuration } from "webpack";
import CopyWebpackPlugin from "copy-webpack-plugin";
import { fileURLToPath } from "url";
import type { Program } from "typescript";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const config: Configuration = {
    mode: (process.env.NODE_ENV as "production" | "development" | undefined) ?? "development",
    entry: "./src/index.tsx",
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/
            },
            {
                test: /\.s?[ac]ss$/i,
                use: [
                    // Creates `style` nodes from JS strings
                    "style-loader",
                    // Translates CSS into CommonJS
                    {
                        loader: "css-loader",
                        options: {
                            // namedExport: true,
                            modules: {
                                mode: "local",
                            }
                        },
                    },
                    // Compiles Sass to CSS
                    "sass-loader",
                ],
            },
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    output: {
        filename: "bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [{ from: "public" }],
        }),
    ],
};

export default config;
