export interface OGState extends Object {
	dist: number;
	door: number;
	vehicle: number;
	rcnt: number;
	fwv: number;
	name: string;
	mac: string;
	cid: number;
	rssi: number;
}

export interface OGResponse extends Object {
	result: number;
}

export enum OGCommand {
	open = "open",
	close = "close",
}

export interface OGSettings extends Object {
	ip?: string;
	port?: number;
	deviceKey?: string;
	pollingRate?: number;
	openCloseTime?: number;
	distanceReadingInterval?: number;
	mode?: string;
	alarm?: string;
	riv?: number;
	dth?: number;
	vth?: number;
	cdt?: number;
	alm?: string;
	aoo?: boolean;
}

export interface OGOptions extends Object {
	fwv?: number;
	sn1?: number;
	sn2?: number;
	sno?: number;
	dth?: number;
	vth?: number;
	riv?: number;
	alm?: number;
	aoo?: number;
	lsz?: number;
	tsn?: number;
	htp?: number;
	cdt?: number;
	dri?: number;
	sfi?: number;
	cmr?: number;
	sto?: number;
	mod?: number;
	ati?: number;
	ato?: number;
	atib?: number;
	atob?: number;
	noto?: number;
	usi?: number;
	ssid?: string;
	auth?: string;
	bdmn?: string;
	bprt?: number;
	name?: string;
	iftt?: string;
	mqtt?: string;
	mqpt?: number;
	mqur?: string;
	mqtp?: string;
	dvip?: string;
	gwip?: string;
	subn?: string;
	dns1?: string;
	ntp1?: string;
	host?: string;
}