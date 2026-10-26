"""Optional CPU-runtime test: exact weights and Torch API restoration."""
import importlib.util
import os
import subprocess
import sys
import unittest
from chickadee.laya_worker import cpu_checkpoint_assignment


@unittest.skipUnless(importlib.util.find_spec('torch'), 'optional Laya CPU runtime not installed')
class CheckpointMemoryTests(unittest.TestCase):
    def test_assignment_preserves_outputs_and_is_scoped_and_restored_on_failure(self):
        # Paddle/OpenCV and Torch may load incompatible Windows DLLs into a
        # shared test interpreter. Production intentionally uses separate workers;
        # exercise this Torch contract in the same fresh-process boundary.
        if os.environ.get('CHICKADEE_LAYA_MEMORY_TEST_CHILD') != '1':
            result = subprocess.run([sys.executable, '-m', 'unittest',
                __name__ + '.CheckpointMemoryTests.test_assignment_preserves_outputs_and_is_scoped_and_restored_on_failure'],
                env={**os.environ, 'CHICKADEE_LAYA_MEMORY_TEST_CHILD': '1'},
                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', timeout=45)
            self.assertEqual(result.returncode, 0, result.stdout)
            return
        import torch
        DecisionModel = type('DecisionModel', (torch.nn.Linear,), {'__module__': 'laya.common'})
        weights = {'weight': torch.tensor([[1., 2., 3.], [-2., 3., 1.]]),
                   'bias': torch.tensor([.5, -.5])}
        expected = torch.nn.Linear(3, 2); expected.load_state_dict(weights)
        optimized = DecisionModel(3, 2)
        original = torch.nn.Module.load_state_dict
        with self.assertRaisesRegex(RuntimeError, 'load failure'):
            with cpu_checkpoint_assignment(torch):
                optimized.load_state_dict(weights)
                self.assertEqual(optimized.weight.data_ptr(), weights['weight'].data_ptr())
                ordinary = torch.nn.Linear(3, 2); ordinary.load_state_dict(weights)
                self.assertNotEqual(ordinary.weight.data_ptr(), weights['weight'].data_ptr())
                raise RuntimeError('load failure')
        self.assertIs(torch.nn.Module.load_state_dict, original)
        self.assertEqual(optimized.weight.dtype, expected.weight.dtype)
        inputs = torch.tensor([[1., -.5, 2.], [0., 1., 4.]])
        torch.testing.assert_close(optimized(inputs), expected(inputs), atol=0, rtol=0)
