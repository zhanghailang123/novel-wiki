import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const apiKkey = process.env.OPENAI_API_KEY || "";
const baseURL = process.env.OPENAI_BASE_URL || "123";

export const modelName = process.env.OPENAI_MODEL_NAME || "123";

if (!apiKkey) {
    console.warn("警告,未检测到OPENAI_API_KEY, 请检查.ENV配置");
}


export const client = new OpenAI({
    apiKey: apiKkey,
    baseURL: baseURL,
});