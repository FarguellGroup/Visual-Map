
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json({ error: 'Invalid API key provided.' }, { status: 400 });
    }

    const envFilePath = path.join(process.cwd(), '.env');
    let envFileContent = '';
    
    try {
        envFileContent = await fs.readFile(envFilePath, 'utf8');
    } catch (error) {
        // .env file might not exist, that's okay.
    }

    const key = 'NEXT_PUBLIC_GOOGLE_GENAI_API_KEY';
    const lines = envFileContent.split('\n');
    let keyFound = false;

    const newLines = lines.map(line => {
      if (line.startsWith(`${key}=`)) {
        keyFound = true;
        return `${key}="${apiKey}"`;
      }
      return line;
    });

    if (!keyFound) {
      newLines.push(`${key}="${apiKey}"`);
    }

    await fs.writeFile(envFilePath, newLines.join('\n'));

    // NOTE: This will NOT update the process.env for the currently running server.
    // The server needs to be restarted for the new .env value to be loaded.
    // The client-side, however, will use the new key from the store.

    return NextResponse.json({ message: 'API key saved successfully.' });

  } catch (error) {
    console.error('Failed to save API key:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
