
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Sparkles, RefreshCw, Loader2, FileText } from 'lucide-react';
import { HighlightedTextRenderer } from './highlighted-text-renderer';
import type { NerSample } from './types';
import { getOldTextHighlightedParts } from '@/lib/ner-utils';
import { correctNERTags } from '@/ai/flows/correct-ner-tags';
import { useToast } from "@/hooks/use-toast";

const defaultSampleData: NerSample[] = [
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
  const [activeSamples, setActiveSamples] = useState<NerSample[]>(defaultSampleData);
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0);
  const [originalOldText, setOriginalOldText] = useState<string>('');
  const [currentNewText, setCurrentNewText] = useState<string>('');
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeSamples.length > 0 && currentSampleIndex < activeSamples.length) {
      const sample = activeSamples[currentSampleIndex];
      setOriginalOldText(sample.old_text);
      setCurrentNewText(sample.new_text);
      setAnimationKey(prev => prev + 1);
    } else {
      // Handle case where there are no samples or index is out of bounds
      setOriginalOldText('');
      setCurrentNewText('');
       if (activeSamples.length === 0) {
        toast({
          title: "No Samples Loaded",
          description: "Upload a CSV or refresh to use default samples.",
          variant: "default",
        });
      }
    }
  }, [currentSampleIndex, activeSamples, toast]);

  const handleNewTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setCurrentNewText(event.target.value);
  };

  const handleLoadNextSample = () => {
    if (activeSamples.length > 0) {
      setCurrentSampleIndex((prevIndex) => (prevIndex + 1) % activeSamples.length);
    } else {
       toast({
          title: "No Samples",
          description: "Upload a CSV file to load samples.",
          variant: "default",
        });
    }
  };

  const handleAiCorrect = async () => {
    if (!originalOldText && !currentNewText) {
      toast({
        title: "No Data",
        description: "Load a sample before using AI Correct.",
        variant: "default",
      });
      return;
    }
    setIsLoadingAi(true);
    try {
      const result = await correctNERTags({
        old_text: originalOldText,
        new_text: currentNewText,
      });
      if (result && result.corrected_text) {
        setCurrentNewText(result.corrected_text);
        setAnimationKey(prev => prev + 1);
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

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (file.type !== 'text/csv') {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        toast({
          title: "File Read Error",
          description: "Could not read the file content.",
          variant: "destructive",
        });
        return;
      }

      const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0);
      if (rows.length < 2) {
        toast({
          title: "Invalid CSV Format",
          description: "CSV must contain a header and at least one data row.",
          variant: "destructive",
        });
        return;
      }

      const header = rows[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
      const oldTextIndex = header.indexOf('old_text');
      const newTextIndex = header.indexOf('new_text');

      if (oldTextIndex === -1 || newTextIndex === -1) {
        toast({
          title: "Missing Columns",
          description: "CSV must contain 'old_text' and 'new_text' columns.",
          variant: "destructive",
        });
        return;
      }

      const newSamples: NerSample[] = [];
      for (let i = 1; i < rows.length; i++) {
        // Basic CSV split, may not handle commas within quoted fields robustly.
        // For more complex CSVs, a dedicated parsing library would be better.
        const values: string[] = [];
        let currentVal = '';
        let inQuotes = false;
        for (const char of rows[i]) {
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(currentVal.trim());
                currentVal = '';
            } else {
                currentVal += char;
            }
        }
        values.push(currentVal.trim());


        if (values.length > Math.max(oldTextIndex, newTextIndex)) {
          const old_text = values[oldTextIndex]?.replace(/^"|"$/g, '').trim();
          const new_text = values[newTextIndex]?.replace(/^"|"$/g, '').trim();
          if (old_text && new_text) {
            newSamples.push({ id: `csv_sample_${i}`, old_text, new_text });
          }
        }
      }

      if (newSamples.length === 0) {
        toast({
          title: "No Valid Data",
          description: "No valid samples found in the CSV file.",
          variant: "destructive",
        });
        return;
      }

      setActiveSamples(newSamples);
      setCurrentSampleIndex(0); // Reset to the first sample of the new CSV
      toast({
        title: "CSV Uploaded",
        description: `${newSamples.length} samples loaded successfully.`,
      });
    };

    reader.onerror = () => {
      toast({
        title: "File Read Error",
        description: "An error occurred while reading the file.",
        variant: "destructive",
      });
    };

    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset file input
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const oldTextHighlightedSegments = useMemo(() => {
    if (!originalOldText) return [];
    return getOldTextHighlightedParts(originalOldText, currentNewText);
  }, [originalOldText, currentNewText]);


  return (
    <div className="flex flex-col flex-grow p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold font-headline">NER Review Tool</h1>
        <div className="flex gap-2 flex-wrap justify-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".csv"
            className="hidden"
          />
          <Button onClick={triggerFileUpload} variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Upload CSV
          </Button>
          <Button onClick={handleLoadNextSample} variant="outline" disabled={activeSamples.length === 0}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Load Next Sample
          </Button>
          <Button onClick={handleAiCorrect} disabled={isLoadingAi || activeSamples.length === 0}>
            {isLoadingAi ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI Correct
          </Button>
        </div>
      </div>

      {activeSamples.length === 0 ? (
         <Card className="flex flex-col items-center justify-center min-h-[400px]">
            <CardHeader>
              <CardTitle className="text-center">No Samples Loaded</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground">
                Please upload a CSV file to start reviewing NER tags.
              </p>
              <Button onClick={triggerFileUpload} className="mt-4">
                <FileText className="mr-2 h-4 w-4" />
                Upload CSV
              </Button>
            </CardContent>
          </Card>
      ) : (
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
      )}
    </div>
  );
}

