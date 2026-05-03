import { ChatPromptTemplate } from '@langchain/core/prompts';

const ROUTER_SYSTEM_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    "You are a routing assistant. Your job is to determine if a question needs document retrieval or can be answered directly.\n\nRespond with either:\n'retrieve' - if the question requires retrieving documents\n'direct' - if the question can be answered directly AND your direct answer",
  ],
  ['human', '{query}'],
]);

const RESPONSE_SYSTEM_PROMPT = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You are an expert assistant for document analysis. Your goal is to provide a concise and accurate summary of the retrieved context that answers the user's question.
    
    Guidelines:
    - Provide the answer in a single, well-structured paragraph.
    - Be professional and direct.
    - If the answer is not in the context, state that you don't know based on the provided documents.`,
  ],
  [
    'human',
    `Question:
    {question}
    
    Context:
    {context}`,
  ],
]);

export { ROUTER_SYSTEM_PROMPT, RESPONSE_SYSTEM_PROMPT };
