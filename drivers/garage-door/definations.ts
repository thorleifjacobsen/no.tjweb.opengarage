export interface OGState {
	dist: number,
	door: number,
	vehicle: number,
	rcnt: number,
	fwv: number,
	name: string,
	mac: string,
	cid: number,
	rssi: number
}

export interface OGResponse {
	result: number
}

export enum OGCommand {
	open = "open",
	close = "close",
}