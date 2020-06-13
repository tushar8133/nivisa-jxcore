var ffi = require('ffi');
var ref = require('ref');
var cp = require('child_process');

var status;
var sesn;
var address;
var vi;

const ViInt32 = ref.types.int32;
const ViPInt32 = ref.refType(ViInt32);
const ViUInt32 = ref.types.uint32;
const ViPUInt32 = ref.refType(ViUInt32);
const ViInt16 = ref.types.int16;
const ViPInt16 = ref.refType(ViInt16);
const ViUInt16 = ref.types.uint16;
const ViPUInt16 = ref.refType(ViUInt16);
const ViChar = ref.types.char;
const ViPChar = ref.refType(ViChar);
const ViByte = ref.types.uchar;
const ViPByte = ref.refType(ViByte);
const ViStatus = ViUInt32;
const ViObject = ViUInt32;
const ViSession = ViUInt32;
const ViPSession = ref.refType(ViSession);
const ViString = ViPChar;
const ViConstString = ViString;
const ViRsrc = ViString;
const ViConstRsrc = ViConstString;
const ViAccessMode = ViUInt32;
const ViBuf = ViPByte;
const ViPBuf = ViPByte;
const ViConstBuf = ViPByte;
const ViFindList = ViObject;
const ViPFindList = ref.refType(ViFindList);

const libVisa = ffi.Library("visa64.dll", {
	'viOpenDefaultRM': [ViStatus, [ViPSession]],
	'viFindRsrc': [ViStatus, [ViSession, 'string', ViPFindList, ViPUInt32, 'string']],
	'viFindNext': [ViStatus, [ViFindList, 'string']],
	'viOpen': [ViStatus, [ViSession, 'string', ViAccessMode, ViUInt32, ViPSession]],
	'viClose': [ViStatus, [ViObject]],
	'viRead': [ViStatus, [ViSession, ViPBuf, ViUInt32, ViPUInt32]],
	'viWrite': [ViStatus, [ViSession, 'string', ViUInt32, ViPUInt32]],
});

function viOpenDefaultRM () {
	let pSesn = ref.alloc(ViSession);
	let status = libVisa.viOpenDefaultRM(pSesn);
	return [status, pSesn.deref()];
}

function viFindRsrc (sesn, expr) {
	let pFindList = ref.alloc(ViFindList);
	let pRetcnt = ref.alloc(ViUInt32);
	let instrDesc = Buffer.alloc(512);
	let status = libVisa.viFindRsrc(sesn, expr, pFindList, pRetcnt, instrDesc);
	return [
		status,
		pFindList.deref(),
		pRetcnt.deref(),
		instrDesc.toString('ascii', 0, instrDesc.indexOf(0))
	];
}

function viFindNext (findList) {
	let instrDesc = Buffer.alloc(512);
	let status = libVisa.viFindNext(findList, instrDesc);
	return [
		status,
		instrDesc.toString('ascii', 0, instrDesc.indexOf(0))
	];
}

function viOpen (sesn, rsrcName, accessMode=0, openTimeout=2000) {
	let pVi = ref.alloc(ViSession);
	let status = libVisa.viOpen(sesn, rsrcName, accessMode, openTimeout, pVi);
	return [status, pVi.deref()];
}

function viClose (vi) {
	return libVisa.viClose(vi);
}

function viRead (vi, count=512) {
	let buf = Buffer.alloc(count);
	let pRetCount = ref.alloc(ViUInt32);
	let status = libVisa.viRead(vi, buf, buf.length, pRetCount)
	return [status, ref.reinterpret(buf, pRetCount.deref(), 0).toString()];
}

function viWrite (vi, buf) {
	let pRetCount = ref.alloc(ViUInt32);
	let status = libVisa.viWrite(vi, buf, buf.length, pRetCount)
	if (pRetCount.deref() != buf.length) {
		throw new Error('viWrite length fail' + `: ${pRetCount.deref()} vs ${buf.length}`)
	}
	return [status, pRetCount.deref()];
}

function vhListResources (sesn, expr='?*') {
	let descList = [];
	let [status, findList, retcnt, instrDesc] = viFindRsrc(sesn, expr);
	if (retcnt) {
		descList.push(instrDesc);
		for (let i = 1; i < retcnt; ++i) {
			[status, instrDesc] = viFindNext(findList);
			descList.push(instrDesc);
		}
	}
	return descList;
}

function vhStatus() {
	let pSesn = ref.alloc(ViSession);
	status = libVisa.viOpenDefaultRM(pSesn);
	sesn = pSesn.deref();
}

function vhAddress() {
	address = [];
    vhListResources(sesn).forEach(adrs => {
        address.push(adrs);
    });
}

function vhSerial() {
    vi = viOpen(sesn, address[0])[1];
  	var query = cp.execFileSync('core');
  	viWrite(vi, query);
  	resp = viRead(vi)[1];
    var result = cp.execFileSync('core', [resp.split(",")[2]]);
    if(result == "1") {
    	console.log(true)
    } else {
    	console.log(false)
    }
    viClose(vi);
}

function vhSCPI(address, query) {
    [status, vi] = viOpen(sesn, address);
    viWrite(vi, query);
  	resp = viRead(vi)[1];
    console.log('>>>', resp);
    viClose(vi);
}

module.exports = {
	vhStatus,
	vhAddress,
	vhSerial,
	vhSCPI
}

vhStatus()
vhAddress();
vhSerial();
vhSCPI('USB0::0x0B5B::0xFFF9::1630010_7880_57::INSTR', '*IDN?');
