#!/usr/bin/env node

// Usage: node decode-token.js <hex-string>
// Example: node decode-token.js 65794a68624763694f694a...

const hexString = process.argv[2];

if (!hexString) {
  console.error('Usage: node decode-token.js <hex-string>');
  process.exit(1);
}

try {
  const token = Buffer.from(hexString, 'hex').toString();
  
  // Check if it's a JWT
  const parts = token.split('.');
  const isJWT = parts.length === 3;
  
  if (isJWT) {
    console.log('\n=== Full JWT Token (Raw) ===');
    console.log(token);
    console.log('\n=== JWT Header (Decoded) ===');
    console.log(JSON.stringify(JSON.parse(Buffer.from(parts[0], 'base64').toString()), null, 2));
    
    console.log('\n=== JWT Payload (Decoded) ===');
    console.log(JSON.stringify(JSON.parse(Buffer.from(parts[1], 'base64').toString()), null, 2));
  } else {
    console.log('\n=== Decoded Token ===');
    console.log(token);
  }
} catch (error) {
  console.error('Error decoding token:', error.message);
  process.exit(1);
}
