// Journal — community reviews section with category filters and a review submission form.

import { useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { SectionReveal, CardStagger, CardStaggerItem, HoverLift } from "../core/motion/cultivMotion";

interface Review {
  id: number;
  name: string;
  rating: 5 | 4 | 3 | 2 | 1;
  category: "BOWLS" | "MORNING" | "HARVEST" | "CORE" | "PERFORMANCE";
  headline: string;
  comment: string;
  verified: boolean;
  reviewCount?: number;
}

export function Journal() {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [showReviewForm, setShowReviewForm] = useState(false);

  const reviews: Review[] = [
    {
      id: 1,
      name: "Arjun R.",
      rating: 5,
      category: "BOWLS",
      headline: "Filling without feeling heavy.",
      comment: "I eat this after class 3–4 times a week. Consistent every time.",
      verified: true,
      reviewCount: 4
    },
    {
      id: 2,
      name: "Priya M.",
      rating: 5,
      category: "BOWLS",
      headline: "Clean ingredients, clear results.",
      comment: "The protein portions are generous and I appreciate the transparency in what goes into each bowl.",
      verified: true,
      reviewCount: 2
    },
    {
      id: 3,
      name: "Karthik S.",
      rating: 4,
      category: "BOWLS",
      headline: "Solid daily option.",
      comment: "Great for lunch. I usually add extra chicken. Fast prep and filling.",
      verified: true
    },
    {
      id: 4,
      name: "Sneha K.",
      rating: 5,
      category: "BOWLS",
      headline: "Part of my weekly routine now.",
      comment: "I've tried every sauce combination. The mild yogurt sauce with spicy chicken is my go-to.",
      verified: true,
      reviewCount: 5
    },
    {
      id: 5,
      name: "Rahul P.",
      rating: 5,
      category: "BOWLS",
      headline: "Simple, clean, reliable.",
      comment: "No surprises. Just good food that supports my training schedule.",
      verified: true
    },
    {
      id: 6,
      name: "Divya L.",
      rating: 4,
      category: "BOWLS",
      headline: "Convenient and balanced.",
      comment: "The brown rice option is perfect for my diet. Pickup is always quick.",
      verified: true
    }
  ];

  const categories = ["ALL", "BOWLS", "MORNING", "HARVEST", "CORE", "PERFORMANCE"];

  const filteredReviews = selectedCategory === "ALL" 
    ? reviews 
    : reviews.filter(r => r.category === selectedCategory);

  const stats = {
    averageRating: 4.8,
    totalBowls: 2184,
    totalReviews: 312
  };

  return (
    <SectionReveal id="journal" className="py-32 relative overflow-hidden bg-gradient-to-b from-background via-[#F5F5F0] to-background">
      {/* Grain texture */}
      <div 
        className="absolute inset-0 opacity-[0.04]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' /%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px'
        }}
      />

      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl mb-6 tracking-tight font-semibold uppercase">
              What Our<br />Community Says
            </h2>
            <p className="text-xl text-foreground/70 leading-relaxed">
              Real feedback. Real routines.
            </p>
          </div>

          {/* Social Proof Counters */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-card/80 backdrop-blur-sm p-8 rounded-2xl border border-border text-center shadow-lg">
              <div className="flex items-center justify-center gap-1 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className={`w-5 h-5 ${i < Math.floor(stats.averageRating) ? 'text-primary fill-primary' : 'text-border'}`} 
                    strokeWidth={2}
                  />
                ))}
              </div>
              <div className="text-4xl font-bold text-foreground mb-1">{stats.averageRating}</div>
              <div className="text-sm text-foreground/60">Average Rating</div>
            </div>

            <div className="bg-card/80 backdrop-blur-sm p-8 rounded-2xl border border-border text-center shadow-lg">
              <div className="text-4xl font-bold text-primary mb-2">
                {stats.totalBowls.toLocaleString()}+
              </div>
              <div className="text-sm text-foreground/60">Bowls Served</div>
            </div>

            <div className="bg-card/80 backdrop-blur-sm p-8 rounded-2xl border border-border text-center shadow-lg">
              <div className="text-4xl font-bold text-foreground mb-2">
                {stats.totalReviews}
              </div>
              <div className="text-sm text-foreground/60">Verified Reviews</div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-2 mb-10 justify-center">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-6 py-3 rounded-xl text-sm font-medium transition-all ${
                  selectedCategory === category
                    ? "bg-primary text-primary-foreground shadow-lg"
                    : "bg-card/80 backdrop-blur-sm border border-border text-foreground/70 hover:border-primary hover:text-foreground"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Reviews Grid */}
          <CardStagger className="grid md:grid-cols-2 gap-6 mb-12">
            {filteredReviews.map((review) => (
              <motion.div 
                key={review.id}
                variants={CardStaggerItem}
                className="bg-card/80 backdrop-blur-sm p-8 rounded-2xl border border-border shadow-lg hover:shadow-xl transition-all relative"
                whileHover={HoverLift.whileHover}
              >
                {/* Category Tag */}
                <div className="inline-flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-lg tracking-wide">
                    {review.category}
                  </span>
                  {review.reviewCount && review.reviewCount >= 3 && (
                    <span className="px-3 py-1 bg-foreground/5 text-foreground/70 text-xs font-medium rounded-lg tracking-wide border border-border">
                      Routine Member
                    </span>
                  )}
                </div>

                {/* Rating */}
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-4 h-4 ${i < review.rating ? 'text-primary fill-primary' : 'text-border'}`} 
                      strokeWidth={2}
                    />
                  ))}
                </div>

                {/* Headline */}
                <h3 className="text-lg font-semibold mb-3 leading-tight">
                  "{review.headline}"
                </h3>

                {/* Comment */}
                <p className="text-foreground/70 text-sm leading-relaxed mb-4">
                  {review.comment}
                </p>

                {/* Author */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="text-sm font-medium text-foreground/80">{review.name}</div>
                  {review.verified && (
                    <div className="text-xs text-foreground/50">Verified</div>
                  )}
                </div>
              </motion.div>
            ))}
          </CardStagger>

          {/* CTA Button */}
          <div className="text-center">
            <motion.button 
              onClick={() => setShowReviewForm(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-10 py-5 rounded-xl transition-all hover:shadow-lg hover:scale-[1.02] text-lg font-medium"
              whileHover={HoverLift.whileHover}
            >
              Share Your Experience
            </motion.button>
          </div>
        </div>
      </div>

      {/* Review Form Modal */}
      {showReviewForm && (
        <ReviewForm onClose={() => setShowReviewForm(false)} />
      )}
    </SectionReveal>
  );
}

function ReviewForm({ onClose }: { onClose: () => void }) {
  const [vertical, setVertical] = useState("");
  const [rating, setRating] = useState(0);
  const [headline, setHeadline] = useState("");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const verticals = ["Bowls", "Morning", "Harvest", "Core", "Performance"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => {
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-20 text-foreground/50 hover:text-foreground transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-8">
          {submitted ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <div className="text-3xl">✓</div>
              </div>
              <h3 className="text-2xl mb-2 font-semibold">Thank You</h3>
              <p className="text-foreground/70">
                Your review will be published after verification.
              </p>
            </div>
          ) : (
            <>
              <h3 className="text-3xl font-semibold mb-2">Share Your Experience</h3>
              <p className="text-foreground/70 text-sm mb-8">
                Help others discover their routine.
              </p>

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Step 1: Select Vertical */}
                <div>
                  <label className="block mb-3 text-base font-semibold">
                    Step 1: Select Vertical
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {verticals.map((v) => (
                      <label
                        key={v}
                        className={`block p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          vertical === v
                            ? "border-primary bg-primary/5 shadow-md"
                            : "border-border hover:border-foreground/30"
                        }`}
                      >
                        <input
                          type="radio"
                          name="vertical"
                          value={v}
                          checked={vertical === v}
                          onChange={(e) => setVertical(e.target.value)}
                          className="sr-only"
                          required
                        />
                        <span className="text-sm font-medium">{v}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Step 2: Star Rating */}
                <div>
                  <label className="block mb-3 text-base font-semibold">
                    Step 2: Rate Your Experience
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star 
                          className={`w-10 h-10 ${star <= rating ? 'text-primary fill-primary' : 'text-border'}`} 
                          strokeWidth={2}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 3: Headline */}
                <div>
                  <label className="block mb-3 text-base font-semibold">
                    Step 3: Short Headline
                  </label>
                  <input
                    type="text"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Sum up your experience in one line"
                    className="w-full p-4 rounded-xl border-2 border-border bg-background focus:border-primary outline-none text-sm"
                    required
                    maxLength={80}
                  />
                  <div className="text-xs text-foreground/50 mt-1">{headline.length}/80</div>
                </div>

                {/* Step 4: Comment */}
                <div>
                  <label className="block mb-3 text-base font-semibold">
                    Step 4: Your Feedback
                  </label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Share more details about your experience"
                    className="w-full p-4 rounded-xl border-2 border-border bg-background focus:border-primary outline-none text-sm min-h-[120px] resize-none"
                    required
                    maxLength={300}
                  />
                  <div className="text-xs text-foreground/50 mt-1">{comment.length}/300</div>
                </div>

                {/* Optional Image Upload Note */}
                <div className="bg-muted/30 rounded-xl p-4 border border-border">
                  <p className="text-xs text-foreground/60 leading-relaxed">
                    <strong className="text-foreground/80">Note:</strong> Reviews are verified before publishing. 
                    Image uploads coming soon.
                  </p>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={!vertical || rating === 0 || !headline || !comment}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-5 rounded-xl transition-all shadow-lg hover:shadow-xl text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit Review
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}