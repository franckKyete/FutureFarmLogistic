import { ProductCategory } from '@futurefarm/types';

export interface VisionAnalysisResult {
  suggestedScore: number;
  detectedDefects: string[];
  analysisNotes: string;
}

export interface ClassificationResult {
  suggestedName: string;
  category: ProductCategory;
  description: string;
  farmingMethods: string;
  recommendedShelfLifeDays: number;
  estimatedQuantity: number | null;
  suggestedPricePerUnit: number | null;
  aiQualityScore: number | null;
}

export interface QualityVisionProvider {
  analyzeHarvestPhotos(photoUrls: string[]): Promise<VisionAnalysisResult>;
  classifyHarvestPhotos(
    photoUrls: string[],
    additionalNotes?: string,
  ): Promise<ClassificationResult>;
}
