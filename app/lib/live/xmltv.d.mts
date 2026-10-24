export interface XmltvChannel {
  id: string;
  name: string;
}

export interface XmltvProgramme {
  channelId: string;
  startMs: number;
  stopMs: number;
  title: string;
  summary: string;
}

export interface XmltvGuide {
  channels: XmltvChannel[];
  programmes: XmltvProgramme[];
}

export interface GuideChannelInput {
  id: string;
  name: string;
  summary: string;
}

export function parseXmltvTimestamp(value: string): number | null;
export function formatXmltvTimestamp(epochMs: number): string;
export function parseXmltv(xml: string): XmltvGuide;
export function programmesBetween(
  programmes: XmltvProgramme[],
  startMs: number,
  endMs: number,
): XmltvProgramme[];
export function buildGuideXml(
  channels: GuideChannelInput[],
  now?: number,
): string;
