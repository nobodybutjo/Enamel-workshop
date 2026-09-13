const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { Signer } = require("@volcengine/openapi");
const path = require('path');
const app = express();
const path = require('path');

// 1. 托管当前目录下的静态资源（css, js, 图片等）
app.use(express.static(__dirname));

// 2. 当访问 首页 (/) 时，返回 index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.use(cors());
app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, '../')));
console.log("🔥 即梦4.0 SDK 稳定整合版启动");

// 填入你的 Access Key 和 Secret Key
const ACCESS_KEY = "AKLTODRkNzdlOWYwMTgzNDBmMjg1MDc1MDFiODJiMWVhYjE";
const SECRET_KEY = "Wmpsa01XSmtaRFEyTmpRMU5HUTNPRGhrTW1aa056TXhOVEpoTURBM05HTQ==";

const REGION = "cn-north-1";
const SERVICE = "cv"; 
const HOST = "visual.volcengineapi.com";

function signRequest({ method, params, body }) {
  const requestObj = {
    region: REGION,
    method,
    params,
    headers: {
      "Content-Type": "application/json",
      Host: HOST
    },
    body: body ? JSON.stringify(body) : ""
  };

  const signer = new Signer(requestObj, SERVICE);
  signer.addAuthorization({
    accessKeyId: ACCESS_KEY,
    secretKey: SECRET_KEY,
  });

  return requestObj.headers;
}

// 1. 烧制预览接口 (整合 free 模式)
app.post("/api/render-preview", async (req, res) => {
  try {
    const { designUrl, pendantShape } = req.body;
    const isHeritage = req.body.isHeritage;
    const timestamp = Date.now();
    
    console.log("------------------------------------------");
    console.log(`🔥 收到渲染请求 - 模式: ${pendantShape}`);

    let submitBody;

    // ================== FREE 模式逻辑 ==================
    if (pendantShape === "free") {
      const promptText = `
        这是一张在平整铜板上烧制的掐丝珐琅工艺品微距特写。
        图案细节、色彩构图必须100%严格参考参考图。
        展现出饱满的玻璃光泽和温润的厚度感。
        背景纯黑，严禁出现任何链条、挂钩、戒指托。
        [RefID: ${timestamp}] 
      `.replace(/\s+/g, " ").trim();

      submitBody = {
        req_key: "jimeng_t2i_v40",
        image_urls: [designUrl], // 单图模式
        prompt: promptText,
        scale: 1.0,              // 强参考
        force_single: true
      };
    } 
    // ================== 吊坠模式逻辑 ==================
    else {
      const BASE_IMAGES = {
        ring: "https://i.ibb.co/39z3phC3/image.png",
        circle: "https://i.ibb.co/DfKmMxFg/image.png",
        ellipse: "https://i.ibb.co/Dfgwg9nm/image.png"
      };
      const baseUrl = BASE_IMAGES[pendantShape] || BASE_IMAGES.ring;

      const promptText = `
        第一张图是一个 ${pendantShape} 形状的银质项链吊坠底托。
        必须严格保持第一张图的金属结构、外轮廓和形状。
        在底托的凹陷区域填入珐琅，珐琅图案和颜色严格参考第二张图。
        生成真实的珐琅烧制效果，整体保持第一张图的轮廓。
        [RefID: ${timestamp}]
      `.replace(/\s+/g, " ").trim();

      submitBody = {
        req_key: "jimeng_t2i_v40",
        image_urls: isHeritage ? [designUrl] : [baseUrl, designUrl], // 兼容非遗
        prompt: promptText,
        scale: 0.5,
        force_single: true
      };
    }

    // 提交任务
    const submitHeaders = signRequest({
      method: "POST",
      params: { Action: "CVSync2AsyncSubmitTask", Version: "2022-08-31" },
      body: submitBody
    });

    const submitResp = await axios.post(
      `https://${HOST}?Action=CVSync2AsyncSubmitTask&Version=2022-08-31`,
      submitBody,
      { headers: submitHeaders }
    );

    const taskId = submitResp.data.data.task_id;
    console.log("✅ 任务已提交, ID:", taskId);

    // 2️⃣ 检查任务结果
        let imageUrl = null;
    
        for (let i = 0; i < 15; i++) {
          await new Promise(r => setTimeout(r, 2000));
    
          const queryBody = {
            req_key: "jimeng_t2i_v40",
            task_id: taskId,
            req_json: JSON.stringify({ return_url: true })
          };
    
          const queryHeaders = signRequest({
            method: "POST",
            params: { Action: "CVSync2AsyncGetResult", Version: "2022-08-31" },
            body: queryBody
          });
    
          const queryResp = await axios.post(
            `https://${HOST}?Action=CVSync2AsyncGetResult&Version=2022-08-31`,
            queryBody,
            { headers: queryHeaders }
          );
    
          const status = queryResp.data.data?.status;
          console.log("状态:", status);
    
          if (queryResp.data.code === 10000 && status === "done") {
            imageUrl = queryResp.data.data.image_urls[0];
            break;
          }
        }
    
        if (!imageUrl) {
          return res.status(500).json({ error: "生成超时" });
        }
    
        res.json({ image: imageUrl });
    
      } catch (err) {
        console.error("🔥 错误:", err.response?.data || err);
        res.status(500).json({ error: "生成失败" });
      }
    });

// 2. 佩戴预览接口
app.post("/api/wear-preview", async (req, res) => {
  try {
    const { pendantUrl } = req.body;
    const MODEL_IMAGE = "https://i.ibb.co/j94McSKX/1.png";
    const promptText = `把第二张图的吊坠做成小项链，自然挂在模特脖子上，保持设计不变。[ID: ${Date.now()}]`.replace(/\s+/g, " ").trim();

    const submitBody = {
      req_key: "jimeng_t2i_v40",
      image_urls: [MODEL_IMAGE, pendantUrl],
      prompt: promptText,
      scale: 0.3,
      force_single: true
    };

    const submitHeaders = signRequest({
      method: "POST",
      params: { Action: "CVSync2AsyncSubmitTask", Version: "2022-08-31" },
      body: submitBody
    });

    const submitResp = await axios.post(
      `https://${HOST}?Action=CVSync2AsyncSubmitTask&Version=2022-08-31`,
      submitBody,
      { headers: submitHeaders }
    );

    const taskId = submitResp.data.data.task_id;
    console.log("👗 佩戴任务提交, ID:", taskId);

    let imageUrl = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const queryHeaders = signRequest({
        method: "POST",
        params: { Action: "CVSync2AsyncGetResult", Version: "2022-08-31" },
        body: { req_key: "jimeng_t2i_v40", task_id: taskId, req_json: JSON.stringify({ return_url: true }) }
      });
      const queryResp = await axios.post(`https://${HOST}?Action=CVSync2AsyncGetResult&Version=2022-08-31`, 
        { req_key: "jimeng_t2i_v40", task_id: taskId, req_json: JSON.stringify({ return_url: true }) }, { headers: queryHeaders });
      
      const status = queryResp.data.data?.status;
      console.log(`[Wear] Status: ${status}`);
      if (status === "done") {
        imageUrl = queryResp.data.data.image_urls[0];
        break;
      }
    }
    res.json({ image: imageUrl });
  } catch (err) {
    res.status(500).json({ error: "wear preview failed" });
  }
});

// 3. 非遗平面图生成接口
app.post("/api/generate-heritage", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const promptText = `参考该非遗的配色与纹样生成一个适合珐琅工艺制作的平面设计图。[ID: ${Date.now()}]`;

    const submitBody = {
      req_key: "jimeng_t2i_v40",
      image_urls: [imageUrl],
      prompt: promptText,
      scale: 0.7,
      force_single: true
    };

    const submitHeaders = signRequest({
      method: "POST",
      params: { Action: "CVSync2AsyncSubmitTask", Version: "2022-08-31" },
      body: submitBody
    });

    const submitResp = await axios.post(`https://${HOST}?Action=CVSync2AsyncSubmitTask&Version=2022-08-31`, submitBody, { headers: submitHeaders });
    const taskId = submitResp.data.data.task_id;

    let resultUrl = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const queryHeaders = signRequest({
        method: "POST",
        params: { Action: "CVSync2AsyncGetResult", Version: "2022-08-31" },
        body: { req_key: "jimeng_t2i_v40", task_id: taskId, req_json: JSON.stringify({ return_url: true }) }
      });
      const queryResp = await axios.post(`https://${HOST}?Action=CVSync2AsyncGetResult&Version=2022-08-31`, 
        { req_key: "jimeng_t2i_v40", task_id: taskId, req_json: JSON.stringify({ return_url: true }) }, { headers: queryHeaders });
      
      if (queryResp.data.data?.status === "done") {
        resultUrl = queryResp.data.data.image_urls[0];
        break;
      }
    }
    res.json({ image: resultUrl });
  } catch (err) {
    res.status(500).json({ error: "heritage generation failed" });
  }
});

app.listen(3000, () => {
  console.log("🌍 Server running on http://localhost:3000");
});

module.exports = app;
