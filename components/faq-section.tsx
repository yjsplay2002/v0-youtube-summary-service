"use client";

import { 
  Accordion, 
  AccordionContent, 
  AccordionItem, 
  AccordionTrigger 
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does the YouTube video summarization work?",
    answer: "Our AI-powered system extracts the transcript from YouTube videos and uses advanced language models like Claude 3.5 to generate comprehensive summaries. The process typically takes just a few seconds and preserves the key insights from the original content."
  },
  {
    question: "What's the difference between subscription tiers?",
    answer: "Free users get 3 summaries per day with basic formatting. Pro users ($9.99/mo) get 25 summaries daily, multiple formats, and videos up to 1 hour. Pro+ users ($19.99/mo) get 100 summaries daily, all formats, videos up to 3 hours, and access to premium AI models."
  },
  {
    question: "Can I summarize private or unlisted YouTube videos?",
    answer: "Yes, as long as the video has captions enabled and is accessible via its URL, our system can process it regardless of its privacy settings. We don't store video content permanently and respect privacy."
  },
  {
    question: "What languages are supported?",
    answer: "We support videos in multiple languages including English, Spanish, French, German, Japanese, Korean, and more. Our AI models can both transcribe and translate content accurately."
  },
  {
    question: "How accurate are the summaries?",
    answer: "Our AI models achieve 99% accuracy in capturing key information from videos. The quality depends on audio clarity and content structure, but we continuously improve our algorithms for better results."
  },
  {
    question: "Can I export or share the summaries?",
    answer: "Yes! All summaries are generated in markdown format, making them easy to copy, export, or share. You can also build a personal knowledge base from your summarized content."
  },
  {
    question: "Is there an API available?",
    answer: "We're working on an API for developers and businesses. Contact us if you're interested in integrating our summarization capabilities into your applications."
  },
  {
    question: "What happens if I cancel my subscription?",
    answer: "You can cancel anytime and continue using paid features until the end of your billing period. After that, you'll be moved to the free tier with 3 summaries per day."
  }
];

export function FAQSection() {
  return (
    <section id="faq" className="py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          <p className="text-muted-foreground text-lg">
            Get answers to common questions about our YouTube summarization service
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`}>
              <AccordionTrigger className="text-left">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}