import { UploadFile } from "antd";

// keep track of local storage schema
export interface PageSettings {
  temperature: number,
  chunkSize: number,
  maxTokenLength: number,
  topp: number,
  chunkOverlap?: number,
  avatar?: UploadFile
}
