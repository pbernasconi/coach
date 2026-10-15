extension ExerciseGuide {
    /// Pull-up, chin-up, lat pulldown, face pull.
    static let pulls: [ExerciseGuide] = [
        ExerciseGuide(
            seed: 13,
            setup: [
                "Grip the bar overhand, hands a little wider than your shoulders.",
                "Hang with your arms straight and your legs still.",
            ],
            steps: [
                "Pull your shoulder blades down and back to start the movement.",
                "Pull yourself up by driving your elbows down toward your ribs.",
                "Keep going until your chin is over the bar.",
                "Lower under control until your arms are straight again.",
            ],
            cues: ["Shoulders down first", "Elbows to the ribs", "No swinging"],
            mistakes: [
                "Kicking or swinging to get up.",
                "Stopping short of straight arms at the bottom.",
                "Reaching the chin up instead of pulling the body up.",
            ],
            breathing: "Breathe out as you pull up. Breathe in as you lower.",
            artSlug: "pull-up",
            videoQuery: "pull up technique"
        ),
        ExerciseGuide(
            seed: 14,
            setup: [
                "Grip the bar underhand, hands about shoulder-width apart.",
                "Hang with your arms straight.",
            ],
            steps: [
                "Set your shoulders by pulling them down, away from your ears.",
                "Pull yourself up, keeping your elbows in front of your body.",
                "Continue until your chin clears the bar.",
                "Lower under control to a full hang.",
            ],
            cues: ["Chest to the bar", "Elbows forward and down", "Full hang every rep"],
            mistakes: [
                "Half reps that never reach straight arms.",
                "Swinging the legs for momentum.",
                "Craning the neck to get the chin over the bar.",
            ],
            breathing: "Breathe out as you pull up. Breathe in as you lower.",
            artSlug: "chin-up",
            videoQuery: "chin up technique"
        ),
        ExerciseGuide(
            seed: 15,
            setup: [
                "Adjust the thigh pad so it holds your legs snugly.",
                "Grip the bar overhand, a little wider than your shoulders, and sit down with your arms straight.",
            ],
            steps: [
                "Lean back slightly and lift your chest.",
                "Pull the bar down to your upper chest, driving your elbows down and back.",
                "Squeeze your shoulder blades down at the bottom.",
                "Let the bar rise under control until your arms are straight.",
            ],
            cues: ["Chest up", "Elbows toward the back pockets", "Control the way up"],
            mistakes: [
                "Leaning far back and rowing the bar down.",
                "Pulling the bar behind the neck.",
                "Letting the weight yank the arms up.",
            ],
            breathing: "Breathe out as you pull down. Breathe in as the bar rises.",
            artSlug: "lat-pulldown",
            videoQuery: "lat pulldown technique"
        ),
        ExerciseGuide(
            seed: 26,
            setup: [
                "Set a cable pulley at upper-chest height or a little higher, with a rope attachment.",
                "Hold the rope with your palms facing each other, step back until your arms are straight, and stand steady.",
            ],
            steps: [
                "Start with your arms straight in front of you.",
                "Pull the rope toward your face, spreading the ends apart.",
                "Lead with your elbows and keep them at or above shoulder height.",
                "Finish with your hands beside your ears and your upper arms out to the sides.",
                "Return under control until your arms are straight.",
            ],
            cues: ["Elbows high", "Pull the rope apart", "Hands finish by the ears"],
            mistakes: [
                "Using too much weight and leaning back.",
                "Elbows dropping so it becomes a row.",
                "Shrugging the shoulders up.",
            ],
            breathing: "Breathe out as you pull. Breathe in as you return.",
            artSlug: nil,
            videoQuery: "cable face pull technique"
        ),
    ]
}
