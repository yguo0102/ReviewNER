'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react';
import { HighlightedTextRenderer } from './highlighted-text-renderer';
import type { NerSample, HighlightedSegment } from './types';
import { getOldTextHighlightedParts } from '@/lib/ner-utils';
import { correctNERTags } from '@/ai/flows/correct-ner-tags';
import { useToast } from "@/hooks/use-toast";

const sampleData: NerSample[] = [
  {
    id: 'sample1',
    old_text: "John went to the Emory clinic for a routine exam on Jan 5, 2023.",
    new_text: "<name> went to the <location> clinic for a routine exam on <date>."
  },
  {
    id: 'sample2',
    old_text: "Meet me at Times Square tomorrow afternoon.",
    new_text: "Meet me at <location> <date>."
  },
  {
    id: 'sample3',
    old_text: "The patient, Jane Doe, reported fever starting on 2024-03-10.",
    new_text: "The patient, <name>, reported fever starting on <date>."
  },
];

export function NERPageContent() {
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);
  const [originalOldText, setOriginalOldText] = useState<string>('');
  const [currentNewText, setCurrentNewText] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [animationKey, setAnimationKey] = useState(0); // Used to trigger re-animation
  const { toast } = useToast();

  useEffect(() => {
    const sample = sampleData[currentSampleIndex];
    setOriginalOldText(sample.old_text);
    setCurrentNewText(sample.new_text);
    setAnimationKey(prev => prev + 1);
  }, [currentSampleIndex]);

  const handleNewTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentNewText(event.target.value);
  };

  const handleLoadNextSample = () => {
    setCurrentSampleIndex((prevIndex) => (prevIndex + 1) % sampleData.length);
  };

  const handleAiCorrect = async () => {
    setIsLoadingAi(true);
    try {
      const result = await correctNERTags({
        old_text: originalOldText,
        new_text: currentNewText,
      });
      if (result && result.corrected_text) {
        setCurrentNewText(result.corrected_text);
        setAnimationKey(prev => prev + 1); // Trigger animation for highlights
        toast({
          title: "AI Correction Applied",
          description: "The new text has been updated with AI suggestions.",
        });
      } else {
        toast({
          title: "AI Correction Failed",
          description: "Could not get corrections from AI.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("AI Correction error:", error);
      toast({
          title: "AI Correction Error",
          description: "An error occurred while applying AI corrections.",
          variant: "destructive",
      });
    } finally {
      setIsLoadingAi(false);
    }
  };

  const oldTextHighlightedSegments = useMemo(() => {
    return getOldTextHighlightedParts(originalOldText, currentNewText);
  }, [originalOldText, currentNewText]);


  return (
    <div className="flex flex-col flex-grow p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold font-headline">NER Review Tool</h1>
        <div className="flex gap-2">
          <Button onClick={handleLoadNextSample} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Load Next Sample
          </Button>
          <Button onClick={handleAiCorrect} disabled={isLoadingAi}>
            {isLoadingAi ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI Correct
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-grow">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Original Text (Read-only)</CardTitle>
            <CardDescription>This is the original text content.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow p-6 bg-muted/30 rounded-b-lg min-h-[200px] overflow-auto">
            <HighlightedTextRenderer segments={oldTextHighlightedSegments} animationKey={animationKey} />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>New Text (Editable)</CardTitle>
            <CardDescription>Edit the text below. Use tags like &lt;name&gt;, &lt;location&gt;, &lt;date&gt;.</CardDescription>
          </CardHeader>
          <CardContent className="flex-grow p-0">
            <Textarea
              value={currentNewText}
              onChange={handleNewTextChange}
              placeholder="Enter new text with NER tags..."
              className="h-full min-h-[200px] w-full resize-none border-0 rounded-t-none rounded-b-lg focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
