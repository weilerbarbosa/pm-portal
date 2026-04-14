# Delivery Teams Cache

Last updated: 2026-03-28

| Team Name | UUID | Typical Role |
|-----------|------|--------------|
| Delivery Devs Fer Team | `082e58b6-7276-4d36-af4f-6b75e3f84fcc` | DEV |
| Delivery Devs Adán Teams | `9caf3414-2e7c-48ea-8d4f-1f16ec9349da` | DEV |
| Delivery BR Devs | `5a40f590-3e7c-4a99-a319-886f0fe18350` | DEV |
| Delivery LATAM Uxers | `be5ddcdb-5f93-4fe4-8b96-e3c43e890867` | UX |
| Delivery BR Uxers | `f9c7b8ff-4bb8-4624-9aea-66e8bcd07e1b` | UX |
| Delivery QAs | `2254e489-e582-41fa-98fb-843c5961b568` | QA |
| Delivery Data | `e9e603bc-ec99-4c33-9b31-c497ead712ef` | DATA |
| PMs Delivery | `bb9f4963-d4a8-4b05-a86d-81efb731f176` | PM |

## How to use

Set `customfield_10001` on each Task after creation using `editJiraIssue`. The field accepts a **plain UUID string** (NOT an object):

```
// CORRECT
{"customfield_10001": "082e58b6-7276-4d36-af4f-6b75e3f84fcc"}

// INCORRECT — returns Bad Request
{"customfield_10001": {"id": "082e58b6-7276-4d36-af4f-6b75e3f84fcc"}}
```

## Refreshing this cache

If a team is missing, search for it via JQL on recent issues:
`project = PROJ AND issuetype = Task ORDER BY created DESC`
and extract `customfield_10001` values. Or ask the user for the team name/UUID.
