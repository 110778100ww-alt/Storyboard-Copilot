use std::sync::{Arc, Mutex};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::info;

use crate::ai::error::AIError;
use crate::ai::{TextGenerationRequest, TextGenerationResponse, TextUsage, TextModelProvider};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GoogleContent {
    parts: Vec<GooglePart>,
    role: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GooglePart {
    text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GoogleGenerateContentRequest {
    contents: Vec<GoogleContent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    generation_config: Option<GoogleGenerationConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    system_instruction: Option<GoogleContent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GoogleGenerationConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    max_output_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GoogleGenerateContentResponse {
    candidates: Option<Vec<GoogleCandidate>>,
    prompt_feedback: Option<GooglePromptFeedback>,
    usage_metadata: Option<GoogleUsageMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GoogleCandidate {
    content: GoogleContent,
    finish_reason: Option<String>,
    index: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GooglePromptFeedback {
    block_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GoogleUsageMetadata {
    prompt_token_count: Option<u32>,
    candidates_token_count: Option<u32>,
    total_token_count: Option<u32>,
}

const GOOGLE_AI_STUDIO_API_BASE: &str = "https://generativelanguage.googleapis.com/v1beta";

pub struct GoogleAIProvider {
    client: Client,
    api_key: Arc<Mutex<Option<String>>>,
    supported_models: Vec<String>,
}

impl GoogleAIProvider {
    pub fn new() -> Self {
        let supported_models = vec![
            "google/gemini-2.0-flash".to_string(),
            "google/gemini-2.5-flash".to_string(),
            "google/gemini-1.5-pro".to_string(),
            "google/gemini-1.5-flash".to_string(),
        ];

        Self {
            client: Client::new(),
            api_key: Arc::new(Mutex::new(None)),
            supported_models,
        }
    }

    fn get_api_key(&self) -> Result<String, AIError> {
        let api_key = self.api_key.lock()
            .map_err(|_| AIError::Provider("无法锁定API密钥".to_string()))?;
        
        api_key.clone()
            .ok_or_else(|| AIError::Provider("Google AI API密钥未配置，请在设置中配置API Key".to_string()))
    }

    async fn make_request(&self, model: &str, request: GoogleGenerateContentRequest) -> Result<GoogleGenerateContentResponse, AIError> {
        let api_key = self.get_api_key()?;
        
        let model_id = model.replace("google/", "");
        let url = format!("{}/models/{}:generateContent?key={}", 
            GOOGLE_AI_STUDIO_API_BASE, model_id, api_key);
        
        let response = self.client
            .post(&url)
            .header("Content-Type", "application/json")
            .json(&request)
            .send()
            .await
            .map_err(|e| AIError::Provider(format!("Failed to send request to Google AI: {}", e)))?;

        if !response.status().is_success() {
            let error_text = response.text().await
                .unwrap_or_else(|_| "Unknown error".to_string());
            return Err(AIError::Provider(format!("Google AI API error: {}", error_text)));
        }

        let google_response: GoogleGenerateContentResponse = response.json().await
            .map_err(|e| AIError::Provider(format!("Failed to parse Google AI response: {}", e)))?;

        Ok(google_response)
    }
}

#[async_trait::async_trait]
impl TextModelProvider for GoogleAIProvider {
    fn name(&self) -> &str {
        "google"
    }

    fn supports_model(&self, model: &str) -> bool {
        self.supported_models.contains(&model.to_string())
    }

    fn list_models(&self) -> Vec<String> {
        self.supported_models.clone()
    }

    async fn set_api_key(&self, api_key: String) -> Result<(), AIError> {
        let mut key = self.api_key.lock()
            .map_err(|_| AIError::Provider("Failed to lock API key mutex".to_string()))?;
        *key = Some(api_key);
        info!("Google AI API key configured");
        Ok(())
    }

    async fn generate_text(&self, request: TextGenerationRequest) -> Result<TextGenerationResponse, AIError> {
        info!("Generating text with Google AI model: {}", request.model);

        let mut parts = Vec::new();
        parts.push(GooglePart { text: request.prompt });

        let contents = vec![GoogleContent {
            parts,
            role: Some("user".to_string()),
        }];

        let mut system_instruction = None;
        if let Some(system_prompt) = request.system_prompt {
            system_instruction = Some(GoogleContent {
                parts: vec![GooglePart { text: system_prompt }],
                role: Some("user".to_string()),
            });
        }

        let generation_config = Some(GoogleGenerationConfig {
            max_output_tokens: request.max_tokens,
            temperature: request.temperature,
        });

        let google_request = GoogleGenerateContentRequest {
            contents,
            generation_config,
            system_instruction,
        };

        let response = self.make_request(&request.model, google_request).await?;

        let Some(candidate) = response.candidates
            .and_then(|mut c| c.pop()) else {
            let block_reason = response.prompt_feedback
                .and_then(|f| f.block_reason)
                .unwrap_or_else(|| "No candidates returned".to_string());
            return Err(AIError::Provider(format!("Google AI blocked request: {}", block_reason)));
        };

        let text = candidate.content.parts
            .into_iter()
            .map(|part| part.text)
            .collect::<Vec<String>>()
            .join("");

        let usage = response.usage_metadata.map(|u| TextUsage {
            prompt_tokens: u.prompt_token_count.unwrap_or(0),
            completion_tokens: u.candidates_token_count.unwrap_or(0),
            total_tokens: u.total_token_count.unwrap_or(0),
        });

        Ok(TextGenerationResponse {
            text,
            model: request.model,
            usage,
        })
    }
}

impl Default for GoogleAIProvider {
    fn default() -> Self {
        Self::new()
    }
}