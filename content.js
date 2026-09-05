/* ------------------------------------------------------------------
   The Journey to Me — 21 Day Self-Transformation Journal
   ------------------------------------------------------------------
   Every word below is transcribed from the client's own PDF.

   To change any wording, edit it here — nothing else needs touching.
   The page numbering, the Table of Contents, the numbered tabs and the
   thickness of the book are all worked out from this file at load time.

   Each day gets: the prompt page, then TWO writing pages, so nobody
   runs out of room part-way through a thought.
------------------------------------------------------------------- */

const JOURNAL = {

  cover: {
    title: 'The Journey to Me',
    subtitle: '21 Day Self-Transformation Journal'
  },

  belongs: {
    heading: 'This Book Belongs to'
  },

  welcome: {
    title: 'Welcome to',
    title2: 'The Beginning of You',
    body: [
      'Have you ever felt like a stranger to yourself? Maybe, in this very moment, you feel lost, uncertain of where to go, or unsure of what comes next.',
      'But,….',
      'What if being lost isn’t the end of your journey, but an invitation to discover the you that you have not met yet?',
      'Over the next 21 days, this journal will guide you on a journey of self-discovery, helping you uncover your thoughts, understand your experiences, and reconnect with your authentic self.',
      'So, take a deep breath, leave behind who you thought you had to be, and prepare to discover who You are becoming.'
    ]
  },

  contents: { title: 'Table of Contents' },

  days: [
    {
      n: 1,
      title: 'The Day of Introduction',
      body: [
        'This is the day of introduction. An important thing to note about an introduction is that it marks the beginning of something.',
        'Today, you begin by introducing yourself to yourself.',
        'So…..',
        'On the next page, take a moment to introduce yourself by stating your name, how old you are, some of your hobbies, your likes, your family, your friends, and anything else you would like yourself to know about you.'
      ]
    },
    {
      n: 2,
      title: 'The Day of “What Would You Change”',
      body: [
        'What would your response be if someone asked you this question: “If you could change anything about your life, what would it be?”',
        'As you journey toward finding yourself, this question gives you an opportunity to explore the things you feel could make your life better or make you a happier person.',
        'So, if you could change at least three things about your life, what would they be, and why?'
      ]
    },
    {
      n: 3,
      title: 'The Day of Participation',
      body: [
        'Today is the day of participation. The goal is simply to record what a typical day looks like for you.',
        'There is a saying, “You are what you continuously do.” So, your challenge is to be completely honest—not only about the good things you do, but also the things you do that you may not like.',
        'This exercise will help you gain deeper understanding of yourself and take another step toward self-discovery and transformation.'
      ]
    },
    {
      n: 4,
      title: 'The Day of Investigation',
      body: [
        'Today is the day of investigation, a day of looking within and honestly discovering who you are beneath the opinions, fears, and expectations of others.',
        'Take time to examine your thoughts, emotions, strengths, weaknesses, and the experiences that have shaped you. Answer this question:',
        'What are your beliefs about yourself and are those beliefs based on truth or wounds from your past?',
        'Be courageous to confront those things you have hidden, ignored, or misunderstood about yourself.'
      ]
    },
    {
      n: 5,
      title: 'The Day of Recognition',
      body: [
        'Recognition is the act of identifying someone or something from a previous experience.',
        'Can you think of something about yourself that you recognize from your childhood?',
        'Answer these two questions:'
      ],
      bullets: [
        'What are some things you enjoyed doing as a child?',
        'What are some experiences from your childhood that have shaped who you are today?'
      ]
    },
    {
      n: 6,
      title: 'The Day of Recall',
      body: [
        'Taking time to recall the moments that have shaped your life can help you better understand who you are and how you are growing.',
        'What parts of your past experiences would you like to carry forward, and what parts would you like to finally let go of as you continue your journey of self-transformation?'
      ]
    },
    {
      n: 7,
      title: 'The Day of Listening',
      body: [
        'When you quiet the noise around you, you create space to hear your thoughts and determine whether they are positive or negative.',
        'Take a moment to listen to your thoughts.',
        'Write down some of those thoughts. After you write them down, identify the negative thoughts and go back in and write a positive response that replaces those negative thoughts.'
      ],
      note: '(Example: “I can never do things right.” Instead write, “I do all things to the best of my ability.”)'
    },
    {
      n: 8,
      title: 'The Day of Walking',
      body: [
        'Every step you take brings you one step closer to your destination.',
        'Ask yourself this question: What is the dream you have for yourself, and what steps can you take each day to become the person who achieves it?'
      ]
    },
    {
      n: 9,
      title: 'The Day of Influence',
      body: [
        'Today is the Day of Influence. Your transformation can inspire others to grow, too.',
        'Think of something kind you can do for someone else, and do it.',
        'Whether it’s offering encouragement, listening to someone, or doing a thoughtful gesture, showing kindness to others can strengthen your self-image and the way you see yourself.',
        'Write down what you did and how you felt afterward.'
      ]
    },
    {
      n: 10,
      title: 'The Day of Asking',
      body: [
        'Today is the Day of Asking. There is a saying, “You have not because you ask not.”',
        'If you could have three wishes granted, what would they be, and why?'
      ]
    },
    {
      n: 11,
      title: 'The Day of Change',
      body: [
        'Change means to make something different or to replace one thing with another.',
        'Think about something that you would like to change. Maybe it’s how you style your hair, trying a new outfit, doing something different to your room, or making another positive change.',
        'The purpose of this activity is for you to do something different so that you can learn how improvement makes you feel.',
        'Write about some of the changes you made and how they made you feel.'
      ]
    },
    {
      n: 12,
      title: 'The Day of Decluttering',
      body: [
        'Decluttering means removing things you no longer need to make space for a more organized and pleasant environment.',
        'Think about things in your room, closet, or other spaces that you may need to get rid of.',
        'Decluttering can help you recognize what is taking up unnecessary space in your life.',
        'Write down some material things you got rid of and why you got rid of them. Then think about some thoughts you need to get rid of, and why you need to get rid of those thoughts.'
      ]
    },
    {
      n: 13,
      title: 'The Day of Letting Go',
      body: [
        'Have you ever experienced something that made you so sad or angry that it continues to affect you, even today?',
        'Letting go means choosing not to let that experience control you.',
        'Write about a situation that you are still trying to move past. End your writing with a sentence that begins with “I release…” and ends with “…it no longer controls me.”'
      ]
    },
    {
      n: 14,
      title: 'The Day of Enlightenment',
      body: [
        'Enlightenment is the process of gaining a deeper understanding of yourself, your experiences, and the world around you.',
        'It is the moment when greater awareness brings clarity, allowing you to see beyond what you once understood.',
        'Think about something you gained a deeper understanding of and how that understanding changed your life.'
      ]
    },
    {
      n: 15,
      title: 'The Day of Stepping Out',
      body: [
        'Have you taken out time recently to discover what your style is? How do you like to style hair? What kind of shoes do you like to wear?',
        'Write about how you like to style your hair, the type of clothes you like to wear, and your style of shoes. Explain why these styles fit your personality and whether they make you feel the most like yourself.'
      ]
    },
    {
      n: 16,
      title: 'The Day of Awareness',
      body: [
        'Take a moment to ask yourself, “Who am I?”',
        'Think about the person you are when you feel free to be yourself, without worrying about how others may see you.',
        'Give yourself time to reflect, and write down whatever thoughts or feelings come to mind.'
      ]
    },
    {
      n: 17,
      title: 'The Day of Preparation',
      body: [
        'Today is a chance to pause, reflect, and prepare for what lies ahead. You don’t have to have everything figured out—just take it one day at a time. Prepare your mind and heart for growth as you become the person you are meant to be.',
        'If you could describe the person you want to become, what would that look like? What would you be like and sound like?'
      ]
    },
    {
      n: 18,
      title: 'The Day of Alignment',
      body: [
        'Alignment is to be placed in the proper position.',
        'Think for a moment about how you feel mentally. Is your mind at a state of peace or chaos? Today is the day to come up with a plan for managing your peace.',
        'What are some areas of your life that you want peace in and what can you do to make that possible?'
      ]
    },
    {
      n: 19,
      title: 'The Day of Readjustment',
      body: [
        'Have you ever had to adjust to a new routine, schedule, or responsibility? Was it easy or difficult? Readjustment means learning to adapt to new situations. As you grow, life will continue to change, and you will learn to adjust along the way.',
        'Think about a situation in your life that helped you become more mature and responsible. What happened, and how did you feel during that time?'
      ]
    },
    {
      n: 20,
      title: 'The Day of Self-Reflection',
      body: [
        'As you reach the day before the final day of this self-transformation journey, take a moment to reflect on who you are and how you feel. Be honest with yourself, and remember that growth takes time. Embrace who you are today while making space for who you are becoming.',
        'Take a moment to write down your thoughts and feelings about yourself and what you have learned throughout this journey.'
      ]
    },
    {
      n: 21,
      title: 'The Day of Realization',
      body: [
        'Self-realization is the process of understanding who you truly are, what you value, and what you want for your life.',
        'Remember, becoming your true self is not about being perfect—it is about growing, learning, and accepting who you are.',
        'Take a moment to write your introduction again by stating your name, your likes, your personality, and some of the biggest lessons you’ve learned on this journey.'
      ]
    }
  ],

  closing: {
    title: 'A Personal Message to You',
    body: [
      'You’ve made it! You stayed committed to your own self-transformation journey and took the time to learn more about yourself.',
      'This is not the end of your journey. Each day is an opportunity to discover more about yourself as you continue to grow and evolve.',
      'Let this self-transformation journal be a tool you can return to each day to stay mindful, self-aware, and focused on becoming the person you want to be.',
      'Feel free to repeat the 21-day self-transformation journey as often as you need to as you gain new insights, growth, and a deeper understanding of yourself.'
    ]
  },

  strings: {
    answerHere: 'Answer on the next page.',
    writeHere: 'Write here…',
    continued: 'continued'
  }
};
