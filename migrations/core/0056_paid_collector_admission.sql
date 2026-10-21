-- Pending and failed Checkouts do not consume collector places. Keep ownership, closure
-- and deadline guards; replace the trigger additively without changing applied SQL.
DROP TRIGGER collector_response_owner_insert;
CREATE TRIGGER collector_response_owner_insert BEFORE INSERT ON response_collector BEGIN
 SELECT RAISE(ABORT,'COLLECTOR_RESPONSE_OWNERSHIP') WHERE NOT EXISTS(
 SELECT 1 FROM responses r JOIN collectors c ON c.flow_id=r.flow_id JOIN flows f ON f.id=r.flow_id
 WHERE r.id=NEW.response_id AND c.id=NEW.collector_id AND f.workspace_id=r.workspace_id
 AND (c.system_source IS NULL OR c.system_source=r.source));
 SELECT RAISE(ABORT,'COLLECTOR_CLOSED') WHERE EXISTS(
 SELECT 1 FROM collectors c JOIN responses r ON r.id=NEW.response_id WHERE c.id=NEW.collector_id
 AND (c.closed_at IS NOT NULL OR (c.deadline_at IS NOT NULL AND c.deadline_at<=r.completed_at)
 OR (c.response_limit IS NOT NULL AND (SELECT count(*) FROM response_collector held WHERE held.collector_id=c.id
 AND NOT EXISTS (SELECT 1 FROM response_payments unpaid WHERE unpaid.response_id=held.response_id AND unpaid.state!='paid'))>=c.response_limit)));
END;
