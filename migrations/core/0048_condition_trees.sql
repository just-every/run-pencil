-- LOGIC-006: published rules retain a bounded tree independently of legacy predicates.
ALTER TABLE flow_branch_rules ADD COLUMN condition_json TEXT CHECK(condition_json IS NULL OR json_valid(condition_json));
