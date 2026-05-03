import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { ChatOpenAI } from '@langchain/openai';

const SUPPORTED_PROVIDERS = [
  'openai',
  'google-genai',
] as const;
/**
 * Load a chat model from a fully specified name.
 * @param fullySpecifiedName - String in the format 'provider/model' or 'provider/account/provider/model'.
 * @returns A Promise that resolves to a BaseChatModel instance.
 */
export async function loadChatModel(
  fullySpecifiedName: string,
  temperature: number = 0.2,
): Promise<BaseChatModel> {
  const index = fullySpecifiedName.indexOf('/');
  if (index === -1) {
    throw new Error(`Unsupported model format. Expected provider/model, got: ${fullySpecifiedName}`);
  } else {
    const provider = fullySpecifiedName.slice(0, index);
    const model = fullySpecifiedName.slice(index + 1);

    if (provider === 'google-genai') {
      return new ChatGoogleGenerativeAI({
        model: 'gemini-3-flash-preview',
        apiKey: process.env.GEMINI_API_KEY,
        streaming: true,
      });
    } else if (provider === 'openai') {
      return new ChatOpenAI({
        modelName: model,
        temperature: temperature,
        apiKey: process.env.OPENAI_API_KEY,
      });
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }
}
