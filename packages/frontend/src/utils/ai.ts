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
- Make sure regex is valid.
- Make sure regex is performance optimized.

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

In both examples notice two lines are returned. The first line is the regex pattern and the second line is the match group number.

Just return the pattern and the group number. Nothing more.`;

export async function askOpenAI(
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
    stream: false,
  };

  try {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const jsonResponse = await response.json();
    const content = jsonResponse.choices[0]?.message?.content;

    if (content) {
      const lines = content.split('\n');
      for (const line of lines) {
        handleContent(line);
      }
    }
  } catch (err) {
    console.error("Fetch error:", err);
    throw err;
  }
}
