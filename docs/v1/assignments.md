# /v1/assignments

API Route for interacting with assignments

## /list

List all assignments.

```json
{
  "success": true,
  "data": [
    {
      "id": "0532de13-a51f-4b9f-b2b4-75866cd3e1d2",
      "name": "Working with npm.",
      "info": {
        "repo": "https://github.com/novaassignments/working-with-npm",
        "desc": "Learn how to utilize npm and how to create / install it's modules."
      },
      "created": 1465538375806,
      "updated": 1465538375806
    },
    {
      "id": "9828c7e8-05bb-43a0-8e6e-16deb7d19443",
      "name": "Introduction to JavaScript",
      "info": {
        "repo": "https://github.com/novajsassignments/introassignment",
        "desc": "The first ever assignment!"
      },
      "created": 1465515905782,
      "updated": 1465523932715
    }
  ]
}
```
