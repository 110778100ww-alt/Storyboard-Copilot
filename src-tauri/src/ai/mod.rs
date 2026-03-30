pub mod error;
pub mod providers;

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use tracing::info;

use error::AIError;

#[derive(Debug, Clone)]
pub struct GenerateRequest {
    pub prompt: String,
    pub model: String,
    pub size: String,
    pub aspect_ratio: String,
    pub reference_images: Option<Vec<String>>,
    pub extra_params: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone)]
pub struct TextGenerationRequest {
    pub prompt: String,
    pub model: String,
    pub system_prompt: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
    pub extra_params: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TextGenerationResponse {
    pub text: String,
    pub model: String,
    pub usage: Option<TextUsage>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TextUsage {
    pub prompt_tokens: u32,
    pub completion_tokens: u32,
    pub total_tokens: u32,
}

#[derive(Debug, Clone)]
pub struct ProviderTaskHandle {
    pub task_id: String,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Clone)]
pub enum ProviderTaskSubmission {
    Queued(ProviderTaskHandle),
    Succeeded(String),
}

#[derive(Debug, Clone)]
pub enum ProviderTaskPollResult {
    Running,
    Succeeded(String),
    Failed(String),
}

#[async_trait::async_trait]
pub trait AIProvider: Send + Sync {
    fn name(&self) -> &str;
    fn supports_model(&self, model: &str) -> bool;

    fn list_models(&self) -> Vec<String> {
        Vec::new()
    }

    async fn set_api_key(&self, _api_key: String) -> Result<(), AIError> {
        Err(AIError::Provider(format!(
            "Provider '{}' does not support API key configuration",
            self.name()
        )))
    }

    fn supports_task_resume(&self) -> bool {
        false
    }

    async fn submit_task(&self, _request: GenerateRequest) -> Result<ProviderTaskSubmission, AIError> {
        Err(AIError::Provider(format!(
            "Provider '{}' does not support resumable task submission",
            self.name()
        )))
    }

    async fn poll_task(&self, _handle: ProviderTaskHandle) -> Result<ProviderTaskPollResult, AIError> {
        Err(AIError::Provider(format!(
            "Provider '{}' does not support resumable task polling",
            self.name()
        )))
    }

    async fn generate(&self, request: GenerateRequest) -> Result<String, AIError>;
}

#[async_trait::async_trait]
pub trait TextModelProvider: Send + Sync {
    fn name(&self) -> &str;
    fn supports_model(&self, model: &str) -> bool;

    fn list_models(&self) -> Vec<String> {
        Vec::new()
    }

    async fn set_api_key(&self, _api_key: String) -> Result<(), AIError> {
        Err(AIError::Provider(format!(
            "Provider '{}' does not support API key configuration",
            self.name()
        )))
    }

    async fn generate_text(&self, request: TextGenerationRequest) -> Result<TextGenerationResponse, AIError>;
}

pub struct ProviderRegistry {
    providers: HashMap<String, Arc<dyn AIProvider>>,
    text_providers: HashMap<String, Arc<dyn TextModelProvider>>,
    default_provider: Option<String>,
    default_text_provider: Option<String>,
}

impl ProviderRegistry {
    pub fn new() -> Self {
        Self {
            providers: HashMap::new(),
            text_providers: HashMap::new(),
            default_provider: None,
            default_text_provider: None,
        }
    }

    pub fn register_provider(&mut self, provider: Arc<dyn AIProvider>) {
        let name = provider.name().to_string();
        info!("Registering AI provider: {}", name);
        self.providers.insert(name.clone(), provider);
        if self.default_provider.is_none() {
            self.default_provider = Some(name);
        }
    }

    pub fn register_text_provider(&mut self, provider: Arc<dyn TextModelProvider>) {
        let name = provider.name().to_string();
        info!("Registering text model provider: {}", name);
        self.text_providers.insert(name.clone(), provider);
        if self.default_text_provider.is_none() {
            self.default_text_provider = Some(name);
        }
    }

    pub fn get_provider(&self, name: &str) -> Option<&Arc<dyn AIProvider>> {
        self.providers.get(name)
    }

    pub fn get_text_provider(&self, name: &str) -> Option<&Arc<dyn TextModelProvider>> {
        self.text_providers.get(name)
    }

    pub fn get_default_provider(&self) -> Option<&Arc<dyn AIProvider>> {
        self.default_provider
            .as_ref()
            .and_then(|name| self.providers.get(name))
    }

    pub fn get_default_text_provider(&self) -> Option<&Arc<dyn TextModelProvider>> {
        self.default_text_provider
            .as_ref()
            .and_then(|name| self.text_providers.get(name))
    }

    pub fn list_providers(&self) -> Vec<String> {
        let mut providers = self.providers.keys().cloned().collect::<Vec<String>>();
        providers.sort();
        providers
    }

    pub fn list_text_providers(&self) -> Vec<String> {
        let mut providers = self.text_providers.keys().cloned().collect::<Vec<String>>();
        providers.sort();
        providers
    }

    pub fn resolve_provider_for_model(&self, model: &str) -> Option<&Arc<dyn AIProvider>> {
        if let Some((provider_id, _)) = model.split_once('/') {
            if let Some(provider) = self.providers.get(provider_id) {
                return Some(provider);
            }
        }

        self.providers
            .values()
            .find(|provider| provider.supports_model(model))
    }

    pub fn resolve_text_provider_for_model(&self, model: &str) -> Option<&Arc<dyn TextModelProvider>> {
        if let Some((provider_id, _)) = model.split_once('/') {
            if let Some(provider) = self.text_providers.get(provider_id) {
                return Some(provider);
            }
        }

        self.text_providers
            .values()
            .find(|provider| provider.supports_model(model))
    }

    pub fn supports_model(&self, model: &str) -> bool {
        self.providers
            .values()
            .any(|provider| provider.supports_model(model))
    }

    pub fn supports_text_model(&self, model: &str) -> bool {
        self.text_providers
            .values()
            .any(|provider| provider.supports_model(model))
    }

    pub fn list_models(&self) -> Vec<String> {
        let mut seen = HashSet::new();
        let mut models = Vec::new();

        for model in self
            .providers
            .values()
            .flat_map(|provider| provider.list_models())
        {
            if seen.insert(model.clone()) {
                models.push(model);
            }
        }

        models.sort();
        models
    }

    pub fn list_text_models(&self) -> Vec<String> {
        let mut seen = HashSet::new();
        let mut models = Vec::new();

        for model in self
            .text_providers
            .values()
            .flat_map(|provider| provider.list_models())
        {
            if seen.insert(model.clone()) {
                models.push(model);
            }
        }

        models.sort();
        models
    }
}

impl Default for ProviderRegistry {
    fn default() -> Self {
        Self::new()
    }
}
