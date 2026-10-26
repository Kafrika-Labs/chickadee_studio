"""Collected local evidence has a separate, bounded offline analysis budget."""
import asyncio
import unittest
from unittest.mock import AsyncMock, patch
from threading import Event
from chickadee.async_runtime import event_loop_runner
from chickadee.scanner import ScanConfig, scan
from chickadee.laya_review import MAX_REVIEW_SECONDS, review_sources


class AnalysisBudgetTests(unittest.TestCase):
    def test_exhausted_collection_deadline_does_not_drop_remaining_local_evidence(self):
        async def crawl(config, state, *_args):
            state.pages.append(config.entry_url)
            await asyncio.sleep(1)
        laya = AsyncMock(return_value={'status':'completed','covered':57,'omitted':0})
        with patch('chickadee.scanner._crawl',side_effect=crawl), \
             patch('chickadee.scanner.enrich_report',side_effect=lambda report,**kw:report.update(local_ai={})), \
             patch('chickadee.scanner.enrich_content_images',new_callable=AsyncMock) as photos, \
             patch('chickadee.scanner.enrich_laya',laya):
            with event_loop_runner() as runner:
                result=runner.run(scan(ScanConfig('http://127.0.0.1/',timeout_sec=.01)))
        self.assertEqual(result.report['status'],'partial')
        self.assertGreater(laya.call_args.kwargs['timeout_seconds'],MAX_REVIEW_SECONDS-2)
        self.assertEqual(photos.call_args.kwargs['timeout_seconds'],45)
        self.assertEqual(result.report['limits']['timeout_scope'],'collection')
        self.assertEqual(result.report['limits']['analysis_timeout_sec'],MAX_REVIEW_SECONDS)

    def test_stop_during_local_analysis_is_cancelled_not_success(self):
        stop=Event()
        async def finish(*_args,**_kwargs):
            stop.set();return {'status':'partial','omitted':57}
        with patch('chickadee.scanner._crawl',new_callable=AsyncMock), \
             patch('chickadee.scanner.enrich_report',side_effect=lambda report,**kw:report.update(local_ai={})), \
             patch('chickadee.scanner.enrich_content_images',new_callable=AsyncMock), \
             patch('chickadee.scanner.enrich_laya',side_effect=finish):
            with event_loop_runner() as runner:
                result=runner.run(scan(ScanConfig('http://127.0.0.1/'),stop=stop))
        self.assertEqual(result.report['status'],'cancelled')

    def test_expired_analysis_budget_reports_every_unprocessed_item(self):
        rows=[{'text':f'원문 {i}'} for i in range(57)]
        with event_loop_runner() as runner:
            summary=runner.run(review_sources(rows,timeout_seconds=0))
        self.assertEqual(summary['omitted'],57)
        self.assertEqual(summary['reason'],'time_budget')
        self.assertTrue(all(r['local_ai']['laya']['reason']=='time_budget' for r in rows))
