export const SYSTEM_PROMPT = `
You are Caido Grep Plugin Regex Generator. Your job is to return a regex pattern based on the user’s request.

Rules:
- Only output two lines:
  - Line 1: The regex pattern
  - Line 2: The match group number
- Do not explain or add anything else.
- The regex should be as accurate and minimal as possible for what the user asked.
- If the pattern has no capturing group, return 0 as match group.
- If there’s a relevant capturing group, return the correct group number that contains the main match.

Examples:
<Input>regex for all urls</Input>
<Output>
https?://[^\"\\'> ]+
0
</Output>

<Input>email regex</Input>
<Output>
[\w.-]+@[\w.-]+\.\w+
0
</Output>

Just return the pattern and the group number. Nothing more.`;

export async function fetchOpenAIStream(
  apiKey: string,
  userPrompt: string,
  systemPrompt: string,
  handleContent: (content: string) => void
): Promise<void> {
  const apiEndpoint = "https://api.openai.com/v1/chat/completions";

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const data = {
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ],
    stream: true,
  };

  async function processStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    controller: ReadableStreamDefaultController<Uint8Array>
  ): Promise<void> {
    const { done, value } = await reader.read();

    if (done) {
      controller.close();
      return;
    }

    controller.enqueue(value);

    const decodedText = new TextDecoder().decode(value);
    const lines = decodedText.split("data:");

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === "[DONE]") return;
      if (!trimmedLine.startsWith("{")) return;

      try {
        const jsonObject = JSON.parse(trimmedLine);
        const content = jsonObject.choices[0]?.delta?.content;
        if (content) {
          handleContent(content);
        }
      } catch (error) {
        console.error("Error parsing JSON:", error);
      }
    });

    return processStream(reader, controller);
  }

  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data),
    });

    const reader = response.body?.getReader();
    if (reader) {
      const stream = new ReadableStream({
        start(controller) {
          processStream(reader, controller);
        },
      });

      await new Response(stream).text();
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}
