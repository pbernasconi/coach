# Template links

A template link adds workout templates to Lift in one tap, so a person's own templates reach their iPhone without
ever being committed here. Tapping the link opens a review sheet that lists the templates and their exercises;
**Add N templates** writes them, and the toast that follows offers **Undo**. Nothing is written before Add.

## Link

```text
lift://templates?d=<payload>
```

`<payload>` is UTF-8 JSON, base64url-encoded (`-` and `_`, padding optional). The app reads at most 12,288 bytes of
JSON (`TemplateLink.maximumJSONBytes`) and 16,500 characters of payload. Make one with:

```bash
python3 lift/scripts/make-template-link.py my-templates.json   # prints the link; keep the JSON outside the repo
```

## Format (version 1)

Keys are the full words below; unknown keys are ignored, so later v1 writers can add optional ones.

| Key | Where | Type | Required | Default | Limits |
| --- | --- | --- | --- | --- | --- |
| `v` | top | integer | yes | | must be `1`; a higher number asks for a newer Lift |
| `unit` | top | `"kg"` or `"lb"` | when a weight is given | | for every template without its own `unit` |
| `templates` | top | array | yes | | 1–20 templates, names unique (compared like exercise names) |
| `name` | template | string | yes | | 1–60 characters, trimmed |
| `unit` | template | `"kg"` or `"lb"` | no | the top `unit` | the unit of this template's weights |
| `exercises` | template | array | yes | | 1–30 exercises, in workout order |
| `name` | exercise | string | yes | | 1–80 characters, trimmed |
| `sets` | exercise | integer | no | 3 | 1–20 |
| `reps` | exercise | integer | no | 8–12 | 1–100; alone it is a fixed target |
| `repMax` | exercise | integer or `null` | no | `reps` | `reps`–100; with `reps`, a range ("8–12") |
| `weight` | exercise | number or `null` | no | none | 0–1,500 in the template's unit; added load for bodyweight work |
| `rest` | exercise | integer (seconds) | no | 120 | 0–1,800 |
| `note` | exercise | string | no | none | up to 280 characters; a planned session starts with it as the exercise note |
| `load` | exercise | `"total"`, `"hand"`, `"side"` or `"bw"` | no | from the name | only for an exercise new to the library |

Weights keep their unit: a template in `lb` stores its loads in pounds, whatever unit the app is set to.

## Exercise names

Each name resolves with the Notes importer's matcher (`ExerciseMatcher`: case, accents, punctuation, simple plurals
and shorthand such as "db" or "kb" are ignored; then aliases; then the same words in a different order; a tie is
no match):

1. **The library**: "Romanian deadlift", "Bulgarian split squat" and "Kettlebell swing" are seed exercises.
2. **The bundled catalog**: "Weighted pull-up" is the catalog's "Weighted Pull-Up", added to the library with its
   equipment, load mode and muscles (`ExerciseRepository.create(fromCatalog:)`).
3. **A new free-text exercise** otherwise: "Dumbbell bench pull" becomes a dumbbell exercise logged per hand. The
   equipment comes from words in the name; `load` overrides how its weight counts.

The review lists the names that become new exercises. Each is created once, however many templates use it.

## Templates that already exist

A template whose name is already in the list is **skipped** by default, so opening the same link twice never
touches a template the person has since edited. Its section in the review has a **Replace the existing one**
switch: the old template is removed (a soft delete) and the new one is added at the end of the list. Undo removes
what the link added, brings back what it replaced and removes the exercises it created.

## Errors

The review explains a link it cannot add, and writes nothing: not base64url, not JSON or a field outside its limits
("This link can't be read"), a newer version ("This link needs a newer Lift"), no templates or a template without
exercises ("This link has no templates"), or over the size cap ("This link is too long").

## Example

Made-up templates, not anyone's real training:

```json
{
  "v": 1,
  "unit": "lb",
  "templates": [
    {
      "name": "Sample lower",
      "exercises": [
        { "name": "Back squat", "sets": 3, "reps": 8, "repMax": null, "weight": 135, "rest": 180, "note": "Made-up cue" },
        { "name": "Dumbbell bench pull", "sets": 3, "reps": 10, "repMax": 12, "weight": 30, "load": "hand" }
      ]
    }
  ]
}
```

```text
lift://templates?d=eyJ2IjoxLCJ1bml0IjoibGIiLCJ0ZW1wbGF0ZXMiOlt7Im5hbWUiOiJTYW1wbGUgbG93ZXIiLCJleGVyY2lzZXMiOlt7Im5hbWUiOiJCYWNrIHNxdWF0Iiwic2V0cyI6MywicmVwcyI6OCwicmVwTWF4IjpudWxsLCJ3ZWlnaHQiOjEzNSwicmVzdCI6MTgwLCJub3RlIjoiTWFkZS11cCBjdWUifSx7Im5hbWUiOiJEdW1iYmVsbCBiZW5jaCBwdWxsIiwic2V0cyI6MywicmVwcyI6MTAsInJlcE1heCI6MTIsIndlaWdodCI6MzAsImxvYWQiOiJoYW5kIn1dfV19
```

The code: `LiftCore/TemplateLink` (reading, limits, name resolution), `LiftStore/TemplateLink` (writing and Undo),
`Lift/Features/Templates` (the review sheet and the toast), `Lift/App/AppLink.swift` (the URL).
