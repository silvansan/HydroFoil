-- Add protocol-specific configuration for RTSP and SRT inputs

ALTER TABLE inputs ADD COLUMN protocol_config JSONB DEFAULT '{}';

-- Index for faster queries on protocol_config
CREATE INDEX inputs_protocol_config_idx ON inputs USING GIN (protocol_config);

-- Add comment explaining the protocol_config structure
COMMENT ON COLUMN inputs.protocol_config IS 
'Protocol-specific configuration stored as JSON. For RTSP: {host, port, path, username, password}. For SRT: {host, port, streamid, username, password, encryption_key}';
