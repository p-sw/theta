# Elysia API Proxy Server

A simple API proxy server built with ElysiaJS.

## API Usage

### POST /proxy

Proxies requests to other APIs.

**Request Format:**

```json
{
  "url": "https://api.example.com/endpoint",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer token",
    "Custom-Header": "value"
  },
  "data": {
    "key": "value",
    "nested": {
      "data": true
    }
  }
}
```

**Response Format (Success):**

```json
{
  "ok": true,
  "status": 200,
  "statusText": "OK",
  "headers": {
    "content-type": "application/json"
  },
  "data": {
    "response": "from target API"
  }
}
```

**Response Format (Error):**

```json
{
  "ok": false,
  "error": "Error message",
  "status": 500
}
```

**Usage Example:**

```bash
curl -X POST http://localhost:3000/proxy \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://jsonplaceholder.typicode.com/posts",
    "method": "POST",
    "headers": {},
    "data": {
      "title": "foo",
      "body": "bar",
      "userId": 1
    }
  }'
```
